"""Build all site datasets from the raw caches and write data/site/*.json.

Outputs (columnar JSON, one shared date axis per file):
  signals.json   point-in-time signal inputs on the trading calendar
  assets.json    total-return indices + splice segments for tradeable assets
  vx_curve.json  VIX futures curve snapshots for the term-structure chart
  meta.json      generation time, per-source status, per-series coverage
"""

from __future__ import annotations

import json
import logging
import math
from pathlib import Path

import numpy as np
import pandas as pd

from ..checks import crosscheck as cc
from ..sources import cboe_indices, cboe_putcall, cfe_vx, fred, treasury, yahoo
from ..sources.fetch_status import load_status
from .align import as_of, master_calendar
from .assets import (
    AssetSpec,
    Segment,
    cash_returns,
    chain_returns,
    price_returns,
    segments_meta,
    to_index,
)
from .vx import curve_snapshots, features

log = logging.getLogger(__name__)

SCHEMA_VERSION = 1
MSCI_WORLD_DIV_YIELD = 0.025  # added to the price-only MSCI World index before URTH (2012)


# ---------------------------------------------------------------- signals
# key -> (label, unit, source, lag_bdays, lag_days, max_stale_days)
SIGNAL_META: dict[str, dict] = {
    "SPX": dict(label="S&P 500 index (price)", unit="index", source="Yahoo ^GSPC"),
    "VIX": dict(label="VIX (30d S&P 500 implied vol)", unit="vol pts", source="Cboe"),
    "VIX9D": dict(label="VIX9D (9d implied vol)", unit="vol pts", source="Cboe"),
    "VIX3M": dict(label="VIX3M (3m implied vol)", unit="vol pts", source="Cboe; Yahoo pre-2009-09"),
    "VIX6M": dict(label="VIX6M (6m implied vol)", unit="vol pts", source="Cboe"),
    "VIX1Y": dict(label="VIX1Y (1y implied vol)", unit="vol pts", source="Cboe"),
    "VOLI": dict(label="VOLI (ATM SPY implied vol)", unit="vol pts", source="Yahoo ^VOLI"),
    "VVIX": dict(label="VVIX (vol of VIX)", unit="vol pts", source="Cboe; Yahoo gaps"),
    "SKEW": dict(label="Cboe SKEW index", unit="index", source="Cboe"),
    "MOVE": dict(label="MOVE (Treasury implied vol)", unit="bp", source="Yahoo ^MOVE"),
    "VX1": dict(label="VIX future, 1st contract", unit="vol pts", source="CFE"),
    "VX2": dict(label="VIX future, 2nd contract", unit="vol pts", source="CFE"),
    "VX1_DTE": dict(label="VX1 days to expiry", unit="days", source="CFE"),
    "VX3": dict(label="VIX future, 3rd contract", unit="vol pts", source="CFE"),
    "VX4": dict(label="VIX future, 4th contract", unit="vol pts", source="CFE"),
    "VX5": dict(label="VIX future, 5th contract", unit="vol pts", source="CFE"),
    "VX6": dict(label="VIX future, 6th contract", unit="vol pts", source="CFE"),
    "VX7": dict(label="VIX future, 7th contract", unit="vol pts", source="CFE"),
    "VX30": dict(label="VX30: 1m constant-maturity VIX future (VTS trading-day roll)",
                 unit="vol pts", source="CFE"),
    "VX_ADJ_M2": dict(label="Adjusted M2 (VTS roll applied to M2/M3)", unit="vol pts",
                      source="CFE"),
    "VX_CM30": dict(label="VIX futures, 30d constant maturity", unit="vol pts", source="CFE"),
    "VX_CM60": dict(label="VIX futures, 60d constant maturity", unit="vol pts", source="CFE"),
    "VX_CM90": dict(label="VIX futures, 90d constant maturity", unit="vol pts", source="CFE"),
    "PC_EQUITY": dict(label="Equity put/call ratio", unit="ratio", source="Cboe"),
    "PC_INDEX": dict(label="Index put/call ratio", unit="ratio", source="Cboe"),
    "PC_TOTAL": dict(label="Total put/call ratio", unit="ratio", source="Cboe"),
    "Y3M": dict(label="3m T-bill yield", unit="%", source="US Treasury; ^IRX fill", lag_bdays=1),
    "Y2Y": dict(label="2y Treasury yield", unit="%", source="US Treasury", lag_bdays=1),
    "Y10Y": dict(label="10y Treasury yield", unit="%", source="US Treasury", lag_bdays=1),
    "HY_OAS": dict(label="US high-yield OAS", unit="%", source="FRED BAMLH0A0HYM2", lag_bdays=1),
    "IG_OAS": dict(label="US investment-grade OAS", unit="%", source="FRED BAMLC0A0CM",
                   lag_bdays=1),
    "BAA10Y": dict(label="Baa minus 10y Treasury", unit="%", source="FRED BAA10Y", lag_bdays=1),
    "NFCI": dict(label="Chicago Fed NFCI", unit="index", source="FRED NFCI", lag_days=5,
                 max_stale_days=14),
    "STLFSI": dict(label="St. Louis Fed Financial Stress Index", unit="index",
                   source="FRED STLFSI4", lag_days=6, max_stale_days=14),
}  # fmt: skip


def _close(raw: Path, sym: str, col: str = "close") -> pd.Series:
    df = yahoo.load(raw, sym)
    return pd.Series(dtype=float) if df is None else df[col].dropna()


def build_signals(raw: Path, cal: pd.DatetimeIndex) -> pd.DataFrame:
    cb = cboe_indices.load(raw)
    s: dict[str, pd.Series] = {"SPX": _close(raw, "^GSPC")}
    for k in ("VIX", "VIX9D", "VIX6M", "VIX1Y", "SKEW"):
        if k in cb:
            s[k] = cb[k]
    s["VOLI"] = _close(raw, "^VOLI")
    # VIX3M: Cboe file starts 2009-09-18; Yahoo carries the series back to 2006.
    s["VIX3M"] = cb["VIX3M"].combine_first(_close(raw, "^VIX3M"))
    s["VVIX"] = cb["VVIX"].combine_first(_close(raw, "^VVIX")[lambda x: x.index >= "2007-01-03"])
    s["MOVE"] = _close(raw, "^MOVE")

    vx = cfe_vx.load(raw)
    if vx is not None:
        # exchange holidays = weekdays missing from the trading calendar
        wk = pd.bdate_range(cal[0], cal[-1])
        holidays = list(wk.difference(cal))
        f = features(vx, cb["VIX"], holidays)
        for k in ("VX1", "VX2", "VX3", "VX4", "VX5", "VX6", "VX7", "VX1_DTE", "VX_CM30",
                  "VX_CM60", "VX_CM90", "VX30", "VX_ADJ_M2"):  # fmt: skip
            s[k] = f[k]

    pc = cboe_putcall.load(raw)
    if pc is not None:
        s["PC_EQUITY"], s["PC_INDEX"], s["PC_TOTAL"] = pc["equity"], pc["index"], pc["total"]

    tc = treasury.load(raw)
    irx = _close(raw, "^IRX")
    s["Y3M"] = tc["y3m"].combine_first(irx) if tc is not None else irx
    if tc is not None:
        s["Y2Y"], s["Y10Y"] = tc["y2y"], tc["y10y"]

    fr = fred.load(raw)
    for key, sid in (("HY_OAS", "BAMLH0A0HYM2"), ("IG_OAS", "BAMLC0A0CM"),
                     ("BAA10Y", "BAA10Y"), ("NFCI", "NFCI"), ("STLFSI", "STLFSI4")):  # fmt: skip
        if fr is not None and sid in fr:
            s[key] = fr[sid]

    out = {}
    for key, meta in SIGNAL_META.items():
        if key not in s or s[key].dropna().empty:
            continue
        out[key] = as_of(
            s[key],
            cal,
            lag_bdays=meta.get("lag_bdays", 0),
            lag_days=meta.get("lag_days", 0),
            max_stale_days=meta.get("max_stale_days", 7),
        )
    return pd.DataFrame(out, index=cal)


# ---------------------------------------------------------------- assets
def _seg(src: str, label: str, synthetic: bool = False) -> Segment:
    return Segment(src, label, synthetic)


ASSETS: list[AssetSpec] = [
    AssetSpec("SPX", "S&P 500 (total return)", "risk",
              [_seg("SPY", "SPY ETF"), _seg("^SP500TR", "S&P 500 TR index", True)], 0.000945),
    AssetSpec("SSO", "S&P 500 2x (SSO)", "risk", [_seg("SSO", "SSO ETF")], 0.0089),
    AssetSpec("UPRO", "S&P 500 3x (UPRO)", "risk", [_seg("UPRO", "UPRO ETF")], 0.0091),
    AssetSpec("WORLD", "MSCI World", "risk",
              [_seg("URTH", "URTH ETF"),
               _seg("^990100-USD-STRD", "MSCI World price index + 2.5% dividend yield", True)],
              0.0024),
    AssetSpec("IEF", "US Treasuries 7-10y", "defensive",
              [_seg("IEF", "IEF ETF"), _seg("VFITX", "Vanguard Intermediate Treasury fund", True)],
              0.0015),
    AssetSpec("TLT", "US Treasuries 20y+", "defensive",
              [_seg("TLT", "TLT ETF"), _seg("VUSTX", "Vanguard Long Treasury fund", True)], 0.0015),
    AssetSpec("AGG", "US Aggregate bonds", "defensive",
              [_seg("AGG", "AGG ETF"), _seg("VBMFX", "Vanguard Total Bond fund", True)], 0.0003),
    AssetSpec("SHY", "US Treasuries 1-3y", "defensive",
              [_seg("SHY", "SHY ETF"), _seg("VFISX", "Vanguard Short Treasury fund", True),
               _seg("cash", "3m T-bill accrual", True)], 0.0015),
    AssetSpec("BIL", "T-bills (cash)", "defensive",
              [_seg("BIL", "BIL ETF"), _seg("cash", "3m T-bill accrual", True)], 0.00135),
    AssetSpec("GLD", "Gold", "defensive",
              [_seg("GLD", "GLD ETF"), _seg("GC=F", "Gold front-month future", True)], 0.004),
    AssetSpec("XLU", "US Utilities", "defensive",
              [_seg("XLU", "XLU ETF"), _seg("FSUTX", "Fidelity Select Utilities fund", True)],
              0.0008),
    AssetSpec("CASH", "3m T-bill (financing / cash rate)", "proxy",
              [_seg("cash", "3m T-bill accrual")]),
    AssetSpec("HYG", "US High Yield (credit proxy)", "proxy",
              [_seg("HYG", "HYG ETF"), _seg("VWEHX", "Vanguard High-Yield Corporate fund", True)]),
    AssetSpec("LQD", "US IG corporates (credit proxy)", "proxy", [_seg("LQD", "LQD ETF")]),
]  # fmt: skip


def build_assets(raw: Path, cal: pd.DatetimeIndex, y3m: pd.Series) -> dict:
    cash = cash_returns(y3m, cal)
    out = {}
    for spec in ASSETS:
        rets = []
        for seg in spec.segments:
            if seg.source == "cash":
                rets.append(cash)
                continue
            px = _close(raw, seg.source, "adj_close")
            if px.empty:
                rets.append(pd.Series(np.nan, index=cal))
                continue
            r = price_returns(px, cal)
            if seg.source == "^990100-USD-STRD":
                r = r + MSCI_WORLD_DIV_YIELD / 252
            rets.append(r)
        r, seg_idx = chain_returns(rets, cal)
        tr = to_index(r)
        out[spec.key] = {
            "label": spec.label,
            "group": spec.group,
            "expense_ratio": spec.expense_ratio,
            "tr": tr,
            "segments": segments_meta(seg_idx, spec),
        }
    return out


# ---------------------------------------------------------------- export helpers
def _round_list(s: pd.Series, sig: int) -> list:
    vals = s.to_numpy(dtype=float)
    out = []
    for v in vals:
        if not math.isfinite(v):
            out.append(None)
        elif sig < 0:  # fixed decimals
            out.append(round(v, -sig))
        else:
            out.append(float(f"{v:.{sig}g}"))
    return out


def _write_json(obj, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(obj, separators=(",", ":"), allow_nan=False))
    tmp.replace(path)


def _fetch_meta(raw: Path) -> dict:
    p = raw / "_fetch_meta.json"
    return json.loads(p.read_text()) if p.exists() else {}


# Inputs the default strategy needs on every day it trades: a date is only
# published (and a live decision logged) once all of them have that date.
# Vendors publish at different times after the close (Yahoo's index bars come
# before its ETF bars; Cboe's VIX row and CFE settlements can lag by hours).
REQUIRED_YAHOO = ["^GSPC", "SPY", "SSO", "IEF", "AGG", "GLD", "XLU", "BIL", "HYG"]
REQUIRED_CBOE = ["VIX", "VIX3M", "VVIX", "SKEW"]


def completeness(raw: Path, cal_last: pd.Timestamp) -> tuple[pd.Timestamp, dict[str, str]]:
    """Last date on which every required input exists, and the inputs lagging cal_last."""
    last: dict[str, pd.Timestamp] = {}
    for sym in REQUIRED_YAHOO:
        v = _close(raw, sym, "adj_close")
        if len(v):
            last[f"Yahoo {sym}"] = v.index[-1]
    cb = cboe_indices.load(raw)
    for k in REQUIRED_CBOE:
        v = cb[k].dropna()
        if len(v):
            last[f"Cboe {k}"] = v.index[-1]
    vx = cfe_vx.load(raw)
    if vx is not None:
        last["CFE VIX futures"] = vx["date"].max()
    pc = cboe_putcall.load(raw)
    if pc is not None:
        last["Cboe equity put/call"] = pc["equity"].dropna().index[-1]
    complete = min([cal_last, *last.values()])
    pending = {k: d.date().isoformat() for k, d in last.items() if d < cal_last}
    return complete, pending


def incomplete_alert(eod: str | None, complete_through: str, pending: dict, now=None) -> str | None:
    """Message if the latest end-of-day date is still incomplete at 12:00 New York time on
    the next business day (4 hours before the close its decision would trade at)."""
    if not eod or not pending or complete_through >= eod:
        return None
    now = now if now is not None else pd.Timestamp.now(tz="America/New_York")
    deadline = (pd.Timestamp(eod) + pd.tseries.offsets.BDay(1)).tz_localize("America/New_York")
    deadline += pd.Timedelta(hours=12)
    if now < deadline:
        return None
    waiting = ", ".join(f"{k} (last {v})" for k, v in pending.items())
    return (
        f"Data for {eod} is still incomplete at {now:%Y-%m-%d %H:%M} New York time; "
        f"the site and the live track record are held at {complete_through}. "
        f"Waiting for: {waiting}."
    )


def build_all(raw: Path, site: Path) -> None:
    gspc = yahoo.load(raw, "^GSPC")
    if gspc is None:
        raise FileNotFoundError("S&P 500 history missing; run `volstrat fetch` first")
    cal = master_calendar(gspc)
    complete_through, pending = completeness(raw, cal[-1])
    if pending:
        log.info("complete through %s; waiting for %s", complete_through.date(), pending)
    full_last = cal[-1]  # latest end-of-day date the index calendar has
    cal = cal[cal <= complete_through]
    dates = [d.strftime("%Y-%m-%d") for d in cal]

    sig = build_signals(raw, cal)
    sig_series = {k: _round_list(sig[k], -2 if k == "SPX" else -4) for k in sig.columns}
    coverage = {}
    for k in sig.columns:
        v = sig[k].dropna()
        coverage[k] = {
            **{m: SIGNAL_META[k].get(m) for m in ("label", "unit", "source")},
            "lag_bdays": SIGNAL_META[k].get("lag_bdays", 0),
            "lag_days": SIGNAL_META[k].get("lag_days", 0),
            "first": v.index[0].date().isoformat() if len(v) else None,
            "last": v.index[-1].date().isoformat() if len(v) else None,
        }
    _write_json({"schema": SCHEMA_VERSION, "dates": dates, "series": sig_series,
                 "meta": coverage}, site / "signals.json")  # fmt: skip

    assets = build_assets(raw, cal, sig["Y3M"] if "Y3M" in sig else pd.Series(dtype=float))
    _write_json(
        {
            "schema": SCHEMA_VERSION,
            "dates": dates,
            "assets": {
                k: {
                    **{m: v[m] for m in ("label", "group", "expense_ratio", "segments")},
                    "tr": _round_list(v["tr"], 9),
                }  # fmt: skip
                for k, v in assets.items()
            },
        },
        site / "assets.json",
    )

    vx = cfe_vx.load(raw)
    if vx is not None:
        snaps = curve_snapshots(vx, cal)
        vdates = sorted(snaps)
        _write_json(
            {
                "schema": SCHEMA_VERSION,
                "dates": [d.strftime("%Y-%m-%d") for d in vdates],
                "curves": [snaps[d] for d in vdates],
            },  # fmt: skip
            site / "vx_curve.json",
        )

    # cross-source sanity checks (warnings shown on the Dashboard)
    cb = cboe_indices.load(raw)
    ys = {k: _close(raw, k) for k in ("^VIX3M", "^VVIX")}
    checks = [
        # compare the ungated calendar: the gate holding back a date is reported via `pending`
        cc.calendar_vs_cboe(full_last, cb["VIX"].dropna().index[-1]),
        *cc.vol_index_agreement(cb, ys),
        cc.spy_vs_index(_close(raw, "SPY", "adj_close"), _close(raw, "^SP500TR")),
        cc.futures_vs_spot(sig),
        *cc.staleness(sig, ["VIX", "VIX3M", "VVIX", "VX1", "PC_EQUITY", "Y3M", "SPX"]),
        *cc.jumps({k: v["tr"] for k, v in assets.items()}),
    ]
    for c in checks:
        if not c.ok:
            log.warning("check failed: %s - %s", c.name, c.detail)

    status = load_status(raw)
    _write_json(
        {
            "schema": SCHEMA_VERSION,
            "generated_at": pd.Timestamp.now(tz="UTC").isoformat(timespec="seconds"),
            "last_date": dates[-1],
            "sources": status,
            "checks": [c.to_dict() for c in checks],
            "eod_cutoff": _fetch_meta(raw).get("eod_cutoff"),
            "complete_through": dates[-1],
            "pending": pending,
            "incomplete_alert": incomplete_alert(
                _fetch_meta(raw).get("eod_cutoff"), dates[-1], pending
            ),
        },
        site / "meta.json",
    )
    log.info("site data written: %d dates, %d signals, %d assets", len(dates), len(sig.columns),
             len(assets))  # fmt: skip
