"""Cboe put/call volume ratios (equity, index, total, SPX+SPXW).

Stitched from four sources; on overlapping dates the newer source wins:
  1. pcratioarchive.csv                       1995-09 -> 2003-12 (total; some index/equity)
  2. {equity,index,total}pcarchive.csv        2003-10 -> 2012-06
  3. {equity,index,total}pc.csv               2006-11 -> 2019-10
  4. daily JSON, one request per day          2019-10-07 -> today
Static files are fetched once; the daily JSON is fetched incrementally.

Index P/C is taken only from source 3 onwards (2006-11-01): over their
2006-2012 overlap the older archive's index ratio runs ~0.1 higher with a
correlation of only 0.72 to the newer file, i.e. a different product universe.
Equity and total ratios agree closely (99th pct abs diff ~0.07) and are stitched.
"""

from __future__ import annotations

import io
import logging
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pandas as pd

from ..http import get
from ..storage import RECONCILE_BDAYS, read_cache, reconcile, safe_write
from .base import SourceStatus, drop_bad, eod_cutoff

log = logging.getLogger(__name__)

BASE = "https://cdn.cboe.com/resources/options/volume_and_call_put_ratios/"
DAILY = "https://cdn.cboe.com/data/us/options/market_statistics/daily/{d}_daily_options"
DAILY_START = pd.Timestamp("2019-10-07")
CACHE = "putcall.csv"
KINDS = ("equity", "index", "total")
JSON_NAMES = {
    "EQUITY PUT/CALL RATIO": "equity",
    "INDEX PUT/CALL RATIO": "index",
    "TOTAL PUT/CALL RATIO": "total",
    "SPX + SPXW PUT/CALL RATIO": "spx",
}
# source rank: higher wins on overlap
RANK = {"pcratioarchive": 1, "pcarchive": 2, "pc": 3, "daily": 4}


def parse_static(text: str) -> pd.DataFrame:
    """Parse any of the static Cboe P/C CSVs: skip the disclaimer, find the DATE header."""
    lines = text.replace("\r", "").split("\n")
    heads = ("date", "trade_date", "trade date")
    start = next(i for i, ln in enumerate(lines) if ln.split(",")[0].strip().lower() in heads)
    df = pd.read_csv(io.StringIO("\n".join(lines[start:])), on_bad_lines="skip", dtype=str)
    df.columns = [c.strip().upper() for c in df.columns]
    df = df.rename(columns={df.columns[0]: "DATE"})
    dates = pd.to_datetime(df["DATE"].str.strip(), format="mixed", errors="coerce")
    out = pd.DataFrame(index=dates)
    for col in df.columns[1:]:
        if "P/C" in col:
            out[col] = pd.to_numeric(df[col].str.strip(), errors="coerce").values
    out = out[out.index.notna()]
    return out[~out.index.duplicated(keep="last")].sort_index()


def _static_frames() -> list[tuple[str, pd.DataFrame]]:
    frames: list[tuple[str, pd.DataFrame]] = []
    a = parse_static(get(BASE + "pcratioarchive.csv").text)
    rename = {}
    for c in a.columns:
        for k in KINDS:
            if c.startswith(k.upper()):
                rename[c] = k
    a = a.rename(columns=rename)[[c for c in ("equity", "total") if c in rename.values()]]
    frames.append(("pcratioarchive", a))
    for suffix, tag in (("pcarchive", "pcarchive"), ("pc", "pc")):
        cols = {}
        for k in KINDS:
            df = parse_static(get(f"{BASE}{k}{suffix}.csv").text)
            ratio = [c for c in df.columns if "P/C" in c]
            cols[k] = df[ratio[0]]
        df = pd.DataFrame(cols)
        if tag == "pcarchive":
            df = df.drop(columns="index")  # inconsistent definition, see module docstring
        frames.append((tag, df))
    return frames


def _daily(day: pd.Timestamp) -> dict | None:
    r = get(DAILY.format(d=day.strftime("%Y-%m-%d")), missing_ok=(403, 404), retries=2)
    if r is None:
        return None
    row = {"date": day}
    for item in r.json().get("ratios", []):
        key = JSON_NAMES.get(item.get("name", "").strip().upper())
        if key:
            row[key] = float(item["value"])
    return row


def stitch(frames: list[tuple[str, pd.DataFrame]]) -> pd.DataFrame:
    """Combine frames per column, higher-ranked sources overriding lower ones."""
    out = pd.DataFrame()
    for tag, df in sorted(frames, key=lambda x: RANK[x[0]]):
        df = df.copy()
        df["src"] = tag
        # only override cells where the new source has a value
        out = df.combine_first(out) if not out.empty else df
    return out.sort_index()


def update(raw_dir: Path, workers: int = 6, cutoff: pd.Timestamp | None = None) -> SourceStatus:
    st = SourceStatus("cboe_putcall", required=False)
    path = raw_dir / CACHE
    cached = read_cache(path)
    today = cutoff if cutoff is not None else eod_cutoff()  # never ask for a provisional day

    if cached is None:
        base = stitch(_static_frames())
        start = DAILY_START
    else:
        base = cached
        daily_rows = cached[cached["src"] == "daily"]
        # re-fetch the last 5 business days so late corrections replace stored values
        start = (
            max(DAILY_START, daily_rows.index.max() - pd.tseries.offsets.BDay(5))
            if len(daily_rows)
            else DAILY_START
        )

    days = pd.bdate_range(start, today)
    with ThreadPoolExecutor(workers) as ex:
        rows = [r for r in ex.map(_daily, days) if r is not None]
    if rows:
        new = pd.DataFrame(rows).set_index("date")
        if cached is not None:
            st.revisions = reconcile(cached, new, ["equity", "index", "total"])
            st.reconciled_days = RECONCILE_BDAYS
        new["src"] = "daily"
        base = new.combine_first(base) if not base.empty else new
        base.loc[new.index, "src"] = "daily"

    base = base.sort_index()
    for k in (*KINDS, "spx"):
        if k in base:
            base[k], n = drop_bad(base[k], 0.05, 10, f"P/C {k}", max_frac=0.005)
            if n:
                st.warnings.append(f"{k}: {n} implausible values removed")
    cols = [c for c in ("equity", "index", "total", "spx", "src") if c in base]
    base = base[cols]
    safe_write(base, path, columns=list(KINDS), rtol=1e-3)
    st.ok, st.rows, st.last_date = True, len(base), base.index[-1].date().isoformat()
    if base.index[-1] < today - pd.tseries.offsets.BDay(5):
        st.warnings.append("daily put/call data more than 5 business days old")
    return st


def load(raw_dir: Path) -> pd.DataFrame | None:
    return read_cache(raw_dir / CACHE)
