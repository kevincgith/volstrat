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
from ..sources import cboe_indices, cboe_putcall, cfe_vx, fred, treasury, unrate, yahoo
from ..sources.fetch_status import load_status
from .absorption import SECTORS, absorption_ratio
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
    "AR2_9": dict(label="Absorption ratio: top 2 of 9 sector ETF principal components",
                  unit="share", source="Yahoo sector ETFs (adjusted)"),
    "NFCI": dict(label="Chicago Fed NFCI", unit="index", source="FRED NFCI", lag_days=5,
                 max_stale_days=14),
    "STLFSI": dict(label="St. Louis Fed Financial Stress Index", unit="index",
                   source="FRED STLFSI4", lag_days=6, max_stale_days=14),
    # monthly, dated the 1st of the month it describes; released about the first Friday of the
    # next month, so used from 41 days after the 1st (on or after the 11th of the next month,
    # PREREG-v13 §2); 70-day staleness bridges a month that was never published (2025-10)
    "UNRATE": dict(label="US unemployment rate", unit="%", source="BLS LNS14000000 (FRED UNRATE)",
                   lag_days=41, max_stale_days=70),
    "UNRATE_GAP": dict(label="Unemployment rate minus its 12-month average (recession gate)",
                       unit="pp", source="BLS LNS14000000 (FRED UNRATE)", lag_days=41,
                       max_stale_days=70),
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

    ur = unrate.load(raw)
    if ur is not None and "UNRATE" in ur:
        s["UNRATE"] = ur["UNRATE"]
        s["UNRATE_GAP"] = unrate.gap(ur["UNRATE"])

    sectors = {k: _close(raw, k, "adj_close") for k in SECTORS}
    if all(len(v) for v in sectors.values()):
        # dates every sector has (one NYSE calendar); a missing day would otherwise
        # reset the 252-day window
        s["AR2_9"] = absorption_ratio(pd.DataFrame(sectors).dropna())

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
def _seg(src: str, label: str, synthetic: bool = False, start: str | None = None) -> Segment:
    return Segment(src, label, synthetic, start)


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
    # factor ETFs: no pre-inception extension (SPLV/SPHB 2011-05, USMV 2011-10, MTUM/VLUE
    # 2013-04, QUAL 2013-07); a backtest holding one starts when it does
    AssetSpec("SPLV", "S&P 500 Low Volatility (SPLV)", "risk", [_seg("SPLV", "SPLV ETF")], 0.0025),
    AssetSpec("USMV", "MSCI USA Min Volatility (USMV)", "risk", [_seg("USMV", "USMV ETF")], 0.0015),
    AssetSpec("QUAL", "MSCI USA Quality (QUAL)", "risk", [_seg("QUAL", "QUAL ETF")], 0.0015),
    AssetSpec("MTUM", "MSCI USA Momentum (MTUM)", "risk", [_seg("MTUM", "MTUM ETF")], 0.0015),
    AssetSpec("VLUE", "MSCI USA Value (VLUE)", "risk", [_seg("VLUE", "VLUE ETF")], 0.0015),
    AssetSpec("SPHB", "S&P 500 High Beta (SPHB)", "risk", [_seg("SPHB", "SPHB ETF")], 0.0025),
    # wider universe (2026-11-04). QQQ 1999-03, QLD 2006-06, EFA 2001-08, DBC 2006-02 and
    # UUP 2007-03 have no pre-inception extension; EEM and VNQ extend with Vanguard index funds
    AssetSpec("QQQ", "Nasdaq-100 (QQQ)", "risk", [_seg("QQQ", "QQQ ETF")]),
    AssetSpec("QLD", "Nasdaq-100 2x (QLD)", "risk", [_seg("QLD", "QLD ETF")]),
    AssetSpec("EFA", "Developed ex-US equities (EFA)", "risk", [_seg("EFA", "EFA ETF")]),
    AssetSpec("EEM", "Emerging-market equities (EEM)", "risk",
              [_seg("EEM", "EEM ETF"),
               _seg("VEIEX", "Vanguard Emerging Markets Index fund", True)]),
    AssetSpec("VNQ", "US REITs (VNQ)", "risk",
              [_seg("VNQ", "VNQ ETF"), _seg("VGSIX", "Vanguard REIT Index fund", True)]),
    AssetSpec("DBC", "Commodities (DBC)", "defensive", [_seg("DBC", "DBC ETF")]),
    AssetSpec("UUP", "US dollar (UUP)", "defensive", [_seg("UUP", "UUP ETF")]),
    # durations (IEI/TLH 2007-01, TIP 2003-12) and cash
    AssetSpec("IEI", "US Treasuries 3-7y", "defensive", [_seg("IEI", "IEI ETF")], 0.0015),
    AssetSpec("TLH", "US Treasuries 10-20y", "defensive", [_seg("TLH", "TLH ETF")], 0.0015),
    AssetSpec("TIP", "US TIPS", "defensive", [_seg("TIP", "TIP ETF")], 0.0018),
    AssetSpec("SGOV", "T-bills 0-3m (SGOV)", "defensive",
              [_seg("SGOV", "SGOV ETF"), _seg("cash", "3m T-bill accrual", True)], 0.0009),
    AssetSpec("USFR", "Floating-rate Treasuries (USFR)", "defensive",
              # thinly traded until ~2017: stale closes and one-day bad prints (e.g. 2014-12-22)
              [_seg("USFR", "USFR ETF", start="2018-01-02"),
               _seg("cash", "3m T-bill accrual", True)], 0.0015),
    AssetSpec("OVERNIGHT", "Overnight cash (fed funds accrual)", "defensive",
              [_seg("dff", "Effective fed funds accrual", True)], 0.001),
    AssetSpec("CASH", "3m T-bill (financing / cash rate)", "proxy",
              [_seg("cash", "3m T-bill accrual")]),
    AssetSpec("HYG", "US High Yield (credit proxy)", "proxy",
              [_seg("HYG", "HYG ETF"), _seg("VWEHX", "Vanguard High-Yield Corporate fund", True)]),
    AssetSpec("LQD", "US IG corporates (credit proxy)", "proxy", [_seg("LQD", "LQD ETF")]),
]  # fmt: skip


def build_assets(raw: Path, cal: pd.DatetimeIndex, y3m: pd.Series) -> dict:
    cash = cash_returns(y3m, cal)
    fr = fred.load(raw)
    dff = fr["DFF"] if fr is not None and "DFF" in fr else pd.Series(dtype=float)
    # overnight rate earned from the close of the day it applies to (same timing as T-bills)
    overnight = cash_returns(dff, cal) if len(dff) else pd.Series(np.nan, index=cal)
    out = {}
    for spec in ASSETS:
        rets = []
        for seg in spec.segments:
            if seg.source in ("cash", "dff"):
                rets.append(cash if seg.source == "cash" else overnight)
                continue
            px = _close(raw, seg.source, "adj_close")
            if seg.start:
                px = px[px.index >= seg.start]
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


# Inputs the strategies need on every day they trade. Vendors publish at different times
# after the close (Yahoo's index bars come before its ETF bars; Cboe's VIX row, CFE
# settlements and the put/call file can lag by hours).
# - The OFFICIAL date waits for every input, prices and score inputs alike: a date becomes
#   official, and is logged in the live records, only when nothing is missing.
# - The PROVISIONAL date waits only for prices (HARD inputs: a portfolio's return cannot be
#   computed without them). Data are published through it so a viewer can opt into the
#   newest date, with late score inputs at their latest known values (point in time, §2.6).
REQUIRED_YAHOO = ["^GSPC", "SPY", "SSO", "IEF", "AGG", "GLD", "XLU", "BIL"]
SOFT_YAHOO = ["HYG"]
REQUIRED_CBOE = ["VIX", "VIX3M", "VVIX", "SKEW"]  # score inputs


def complete_date(cal: pd.DatetimeIndex, inputs: dict[str, pd.Timestamp]) -> pd.Timestamp:
    """Latest calendar date on which every input in `inputs` has a value."""
    for day in reversed(cal):
        if all(v >= day for v in inputs.values()):
            return day
    return min([cal[-1], *inputs.values()])


def completeness(
    raw: Path, cal: pd.DatetimeIndex
) -> tuple[pd.Timestamp, dict[str, str], pd.Timestamp]:
    """Official date (every input), inputs the latest date is still waiting for, and the
    provisional date (every price)."""
    hard: dict[str, pd.Timestamp] = {}
    soft: dict[str, pd.Timestamp] = {}
    for sym in REQUIRED_YAHOO + SOFT_YAHOO:
        v = _close(raw, sym, "adj_close")
        if len(v):
            (soft if sym in SOFT_YAHOO else hard)[f"Yahoo {sym}"] = v.index[-1]
    cb = cboe_indices.load(raw)
    for k in REQUIRED_CBOE:
        v = cb[k].dropna()
        if len(v):
            soft[f"Cboe {k}"] = v.index[-1]
    vx = cfe_vx.load(raw)
    if vx is not None:
        soft["CFE VIX futures"] = vx["date"].max()
    pc = cboe_putcall.load(raw)
    if pc is not None:
        soft["Cboe equity put/call"] = pc["equity"].dropna().index[-1]
    everything = {**hard, **soft}
    official = complete_date(cal, everything)
    provisional = max(official, complete_date(cal, hard))
    pending = {k: v.date().isoformat() for k, v in everything.items() if v < cal[-1]}
    return official, pending, provisional


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
    complete_through, pending, provisional = completeness(raw, cal)
    if pending:
        log.info("complete through %s; waiting for %s", complete_through.date(), pending)
    full_last = cal[-1]  # latest end-of-day date the index calendar has
    # Data are published through the provisional date (every price in, score inputs possibly
    # late); `complete_through` marks the official date. The site uses the official date
    # unless the viewer opts into the latest data; the live records and alerts always do.
    cal = cal[cal <= provisional]
    dates = [d.strftime("%Y-%m-%d") for d in cal]
    official = complete_through.strftime("%Y-%m-%d")

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
            "last_date": official,
            "sources": status,
            "checks": [c.to_dict() for c in checks],
            "eod_cutoff": _fetch_meta(raw).get("eod_cutoff"),
            "complete_through": official,
            "provisional_through": dates[-1],
            "pending": pending,
            "incomplete_alert": incomplete_alert(
                _fetch_meta(raw).get("eod_cutoff"), official, pending
            ),
        },
        site / "meta.json",
    )
    log.info("site data written: %d dates, %d signals, %d assets", len(dates), len(sig.columns),
             len(assets))  # fmt: skip
