"""European holdout data for VolStrat v3 (docs/PREREG-v3.md section 2).

Builds daily inputs for the Euro Stoxx 50 market, 1999 onwards:
  - VSTOXX (STOXX), and its 1M / 3M sub-indices (STOXX, to 2016-02)
  - Euro Stoxx 50 price (STOXX file to 2016-10, Yahoo ^STOXX50E after) plus an
    estimated 3.0% a year dividend yield; the DAX (a total-return index) as a check
  - a synthetic 7-year government zero-coupon bond: ECB AAA curve 7y spot rate,
    daily from 2004-09; before that, monthly German 10y yields, each month's
    return spread evenly over its trading days
  - cash: EONIA, then euro short-term rate (ESTR) from 2019-10

Only data checks are computed here (coverage, gaps, spikes, cross-source
agreement). Signals and strategy statistics on this data are reserved for the
single pre-registered holdout run.
"""

from __future__ import annotations

import io
import json
import logging

import numpy as np
import pandas as pd

from . import REPO_ROOT
from .http import get

log = logging.getLogger(__name__)

RAW = REPO_ROOT / "data" / "raw" / "europe"
OUT = REPO_ROOT / "data" / "europe"

STOXX = "https://www.stoxx.com/document/Indices/Current/HistoricalData/"
ECB = "https://data-api.ecb.europa.eu/service/data/{key}?format=csvdata&detail=dataonly"
ECB_KEYS = {
    "eonia": "EON/D.EONIA_TO.RATE",
    "estr": "EST/B.EU000A2X2A25.WT",
    "aaa7y": "YC/B.U2.EUR.4F.G_N_A.SV_C_YM.SR_7Y",
    "aaa10y": "YC/B.U2.EUR.4F.G_N_A.SV_C_YM.SR_10Y",
    "de10y_monthly": "IRS/M.DE.L.L40.CI.0000.EUR.N.Z",
}
DIV_YIELD = 0.03
BOND_YEARS = 7
START = "1999-01-01"


# ------------------------------------------------------------------ download
def _save(name: str, text: str) -> None:
    """Keep a raw file; never replace it with a shorter download."""
    RAW.mkdir(parents=True, exist_ok=True)
    path = RAW / name
    if path.exists() and len(text) < 0.9 * path.stat().st_size:
        log.warning("%s: download is shorter than the stored file; kept stored", name)
        return
    path.write_text(text)


def _curl(url: str) -> str:
    # STOXX's certificate chains to the Comodo "AAA Certificate Services" root, which the
    # Mozilla bundle Python uses no longer carries; the macOS system store still trusts it.
    # The system curl verifies against that store (verification stays on).
    import subprocess

    return subprocess.run(
        ["curl", "-sSfL", "--max-time", "120", url], check=True, capture_output=True, text=True
    ).stdout


def fetch() -> None:
    for f in ("h_v2tx.txt", "h_vstoxx.txt", "hbrbcpe.txt"):
        _save(f, _curl(STOXX + f))
    for name, key in ECB_KEYS.items():
        _save(f"ecb_{name}.csv", get(ECB.format(key=key), timeout=90).text)
    import yfinance as yf  # lazy: heavy

    for sym in ("^STOXX50E", "^GDAXI"):
        h = yf.Ticker(sym).history(period="max", auto_adjust=False, actions=False)
        s = h["Close"].copy()
        s.index = pd.DatetimeIndex(h.index.tz_localize(None).normalize())
        # today's bar may be intraday: keep only closes strictly before today (UTC)
        s = s[s.index < pd.Timestamp.utcnow().tz_localize(None).normalize()]
        _save(f"yahoo_{sym.strip('^')}.csv", s.rename("close").to_csv())


# ------------------------------------------------------------------ parsing
def _stoxx_semicolon(name: str) -> pd.Series:
    df = pd.read_csv(RAW / name, sep=";")
    return pd.Series(
        df["Indexvalue"].astype(float).values, index=pd.to_datetime(df["Date"], dayfirst=True)
    )


def load_vstoxx() -> pd.DataFrame:
    v2tx = _stoxx_semicolon("h_v2tx.txt").rename("V2TX")
    lines = (RAW / "h_vstoxx.txt").read_text().splitlines()
    head = next(i for i, line in enumerate(lines) if line.startswith("Date,"))
    sub = pd.read_csv(io.StringIO("\n".join(lines[head:])))
    sub.index = pd.to_datetime(sub.pop("Date"), dayfirst=True)
    sub = sub.apply(pd.to_numeric, errors="coerce")
    df = pd.concat([v2tx, sub[["V6I1", "V6I3"]], sub["V2TX"].rename("V2TX_sub")], axis=1)
    return df.sort_index()


def load_sx5e() -> tuple[pd.Series, pd.Series]:
    lines = (RAW / "hbrbcpe.txt").read_text(errors="ignore").splitlines()
    rows = [line.split(";") for line in lines if line[:2].isdigit()]
    s = pd.Series(
        [float(r[2]) for r in rows],
        index=pd.to_datetime([r[0].strip() for r in rows], dayfirst=True),
    ).sort_index()
    s = s[s > 0]  # the file writes 0.00 on market holidays (e.g. Good Friday 2016)
    y = pd.read_csv(RAW / "yahoo_STOXX50E.csv", index_col=0, parse_dates=True)["close"]
    return s[~s.index.duplicated()], y


def load_dax() -> pd.Series:
    return pd.read_csv(RAW / "yahoo_GDAXI.csv", index_col=0, parse_dates=True)["close"]


def load_ecb(name: str) -> pd.Series:
    df = pd.read_csv(RAW / f"ecb_{name}.csv")
    idx = (
        pd.PeriodIndex(df["TIME_PERIOD"], freq="M").to_timestamp()
        if name.endswith("monthly")
        else pd.to_datetime(df["TIME_PERIOD"])
    )
    return (
        pd.Series(pd.to_numeric(df["OBS_VALUE"], errors="coerce").values, index=idx)
        .dropna()
        .sort_index()
    )


# ------------------------------------------------------------------ build
def zero_bond_returns(
    y_pct: pd.Series, cal: pd.DatetimeIndex, years: float = BOND_YEARS
) -> pd.Series:
    """Daily return of a constant-maturity zero-coupon bond from its yield: repriced on the
    yield change, plus carry at the previous day's yield (roll-down ignored)."""
    y = y_pct.reindex(cal).ffill(limit=10) / 100
    days = pd.Series(cal, index=cal).diff().dt.days
    y0 = y.shift(1)
    return ((1 + y0) ** years / (1 + y) ** years) * (1 + y0) ** (days / 365) - 1


def monthly_bond_returns(
    y_month_pct: pd.Series, cal: pd.DatetimeIndex, years: float = BOND_YEARS
) -> pd.Series:
    """Monthly zero-bond return from month-average yields, spread geometrically evenly over
    the month's trading days (a smoothed daily path; month totals are exact for the model)."""
    y = y_month_pct / 100
    r_m = ((1 + y.shift(1)) ** years / (1 + y) ** years) * (1 + y.shift(1)) ** (1 / 12) - 1
    out = pd.Series(np.nan, index=cal)
    for m, r in r_m.dropna().items():
        days = cal[(cal.year == m.year) & (cal.month == m.month)]
        if len(days):
            out[days] = (1 + r) ** (1 / len(days)) - 1
    return out


def cash_returns(rate_pct: pd.Series, cal: pd.DatetimeIndex) -> pd.Series:
    """ACT/360 accrual at the previous day's overnight rate."""
    r = rate_pct.reindex(cal.union(rate_pct.index)).ffill(limit=10).reindex(cal)
    days = pd.Series(cal, index=cal).diff().dt.days
    return r.shift(1) / 100 * days / 360


def to_index(r: pd.Series) -> pd.Series:
    first = r.first_valid_index()
    out = (1 + r.fillna(0)).cumprod()
    out[out.index < first] = np.nan
    return out


def build() -> dict:
    vs = load_vstoxx()
    sx_file, sx_yahoo = load_sx5e()
    dax = load_dax()
    # master calendar: Euro Stoxx 50 trading days (STOXX file, then Yahoo after it ends)
    sx = pd.concat([sx_file, sx_yahoo[sx_yahoo.index > sx_file.index[-1]]])
    cal = sx.index[sx.index >= START]
    sxc = sx.reindex(cal)

    eq = sxc.pct_change() + DIV_YIELD / 252
    dax_r = dax.reindex(cal.union(dax.index)).ffill(limit=5).reindex(cal).pct_change()
    aaa7 = load_ecb("aaa7y")
    daily_from = aaa7.index[0]
    bond = monthly_bond_returns(load_ecb("de10y_monthly"), cal)
    d_r = zero_bond_returns(aaa7, cal)
    bond[cal > daily_from] = d_r[cal > daily_from]
    # days between the last monthly-filled day and the first daily return: carry only
    gap = bond.index[(bond.index >= daily_from) & bond.isna()]
    bond[gap] = 0.0
    eonia, estr = load_ecb("eonia"), load_ecb("estr")
    rate = pd.concat([eonia[eonia.index < "2019-10-01"], estr[estr.index >= "2019-10-01"]])
    cash = cash_returns(rate, cal)

    series = {
        "SX5E": sxc,
        "V2TX": vs["V2TX"].reindex(cal),
        "V6I1": vs["V6I1"].reindex(cal),
        "V6I3": vs["V6I3"].reindex(cal),
        "DAX": dax.reindex(cal.union(dax.index)).ffill(limit=5).reindex(cal),
    }
    assets = {
        "EQ_SX5E": eq,
        "EQ_DAX": dax_r,
        "BOND_EU7": bond,
        "CASH_EUR": cash,
    }
    rnd = lambda s, k: [None if not np.isfinite(v) else round(float(v), k) for v in s.values]  # noqa: E731
    out = {
        "schema": 1,
        "note": "European holdout inputs for v3 (docs/PREREG-v3.md). Synthetic: EQ_SX5E dividends "
        "(3.0%/yr), BOND_EU7 (from yields; monthly-smoothed before 2004-09-06).",
        "dates": [d.strftime("%Y-%m-%d") for d in cal],
        "series": {k: rnd(v, 4) for k, v in series.items()},
        "assets": {k: rnd(to_index(v), 9) for k, v in assets.items()},
        "bond_daily_from": daily_from.strftime("%Y-%m-%d"),
    }
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "europe.json").write_text(json.dumps(out, separators=(",", ":")))
    checks_out = checks(vs, sx_file, sx_yahoo, dax, eonia, estr, aaa7, cal, eq, dax_r, bond, cash)
    (OUT / "checks.json").write_text(json.dumps(checks_out, indent=1))
    return checks_out


# ------------------------------------------------------------------ data checks only
def _gaps(idx: pd.DatetimeIndex, days: int = 5) -> list[str]:
    d = idx.to_series().diff().dt.days
    return [
        f"{a.date()}..{b.date()}"
        for a, b, g in zip(idx[:-1], idx[1:], d.iloc[1:], strict=True)
        if g > days and not (a.month == 12 and a.day >= 20)
    ]


def checks(vs, sx_file, sx_yahoo, dax, eonia, estr, aaa7, cal, eq, dax_r, bond, cash) -> dict:
    c: dict = {}
    for name, s in {
        "V2TX": vs["V2TX"].dropna(),
        "V6I3": vs["V6I3"].dropna(),
        "SX5E_file": sx_file,
        "SX5E_yahoo": sx_yahoo,
        "DAX": dax,
        "EONIA": eonia,
        "ESTR": estr,
        "AAA7Y": aaa7,
    }.items():
        s = s[s.index >= START] if len(s) else s
        c[name] = {
            "first": str(s.index[0].date()),
            "last": str(s.index[-1].date()),
            "rows": int(len(s)),
            "gaps_over_5_days_ex_christmas": _gaps(s.index),
        }
    # cross-source agreement
    ov = pd.concat([sx_file.rename("file"), sx_yahoo.rename("yahoo")], axis=1).dropna()
    rel = (ov["yahoo"] / ov["file"] - 1).abs()
    c["SX5E_file_vs_yahoo"] = {
        "overlap_days": int(len(ov)),
        "max_abs_rel_diff": round(float(rel.max()), 5),
        "share_days_over_0.1pct": round(float((rel > 0.001).mean()), 4),
        "worst_day": str(rel.idxmax().date()),
    }
    vv = vs[["V2TX", "V2TX_sub"]].dropna()
    c["V2TX_vs_subindex_file"] = {
        "overlap_days": int(len(vv)),
        "max_abs_diff": round(float((vv["V2TX"] - vv["V2TX_sub"]).abs().max()), 4),
    }
    o = pd.concat(
        [eonia.rename("eonia"), (estr + 0.085).rename("estr_plus_8.5bp")], axis=1
    ).dropna()
    c["EONIA_vs_ESTR_plus_8.5bp"] = {
        "overlap_days": int(len(o)),
        "max_abs_diff_pct": round(float((o.iloc[:, 0] - o.iloc[:, 1]).abs().max()), 4),
    }
    m10 = load_ecb("aaa10y").resample("MS").mean()
    de = load_ecb("de10y_monthly")
    j = pd.concat([m10.rename("aaa10"), de.rename("de10")], axis=1).dropna()
    dj = j["aaa10"] - j["de10"]
    c["AAA10y_vs_German10y_monthly"] = {
        "overlap_months": int(len(j)),
        "mean_diff_pct": round(float(dj.mean()), 3),
        "max_abs_diff_pct": round(float(dj.abs().max()), 3),
    }
    # spikes and plausibility of the built return series
    for name, r, lim in (
        ("EQ_SX5E", eq, 0.12),
        ("EQ_DAX", dax_r, 0.12),
        ("BOND_EU7", bond, 0.03),
        ("CASH_EUR", cash, 0.001),
    ):
        r = r.dropna()
        big = r[r.abs() > lim]
        ann = (1 + r).prod() ** (252 / len(r)) - 1
        c[f"returns_{name}"] = {
            "first": str(r.index[0].date()),
            "days": int(len(r)),
            "annualised": round(float(ann), 4),
            f"days_beyond_{lim}": {str(k.date()): round(float(v), 4) for k, v in big.items()},
        }
    after = sx_yahoo[sx_yahoo.index > sx_file.index[-1]]
    rep = after[after.diff() == 0]
    c["SX5E_yahoo_after_file_unchanged_closes"] = [str(d.date()) for d in rep.index]
    c["calendar"] = {
        "first": str(cal[0].date()),
        "last": str(cal[-1].date()),
        "days": int(len(cal)),
    }
    c["V2TX_missing_on_calendar_days"] = int(vs["V2TX"].reindex(cal).isna().sum())
    return c


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    import sys

    if "--no-fetch" not in sys.argv:
        fetch()
    print(json.dumps(build(), indent=1))
