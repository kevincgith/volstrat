"""Cboe volatility index history (VIX, VIX9D, VIX3M, VIX6M, VVIX, SKEW).

Full files are small, so every run re-downloads them and checks that history
is unchanged.
"""

from __future__ import annotations

import io
import logging
from pathlib import Path

import pandas as pd

from ..http import get
from ..storage import RECONCILE_BDAYS, read_cache, reconcile, safe_write
from .base import SourceStatus, cut, drop_bad, eod_cutoff

log = logging.getLogger(__name__)

URL = "https://cdn.cboe.com/api/global/us_indices/daily_prices/{sym}_History.csv"
# symbol -> (value column in the file, plausible range)
SYMBOLS: dict[str, tuple[str, tuple[float, float]]] = {
    "VIX": ("CLOSE", (5, 150)),
    "VIX9D": ("CLOSE", (3, 250)),
    "VIX3M": ("CLOSE", (5, 120)),
    "VIX6M": ("CLOSE", (5, 100)),
    "VIX1Y": ("CLOSE", (5, 100)),
    "VVIX": ("VVIX", (40, 300)),
    "SKEW": ("SKEW", (90, 200)),
}
# Cboe's VVIX file starts 2006-03-06 but its 2006 values include obvious
# errors (e.g. 15.71); history is used from 2007, where Yahoo's also starts.
START = {"VVIX": "2007-01-03"}
CACHE = "cboe_indices.csv"


def parse(text: str, value_col: str) -> pd.Series:
    df = pd.read_csv(io.StringIO(text))
    df.columns = [c.strip().upper() for c in df.columns]
    if "DATE" not in df or value_col not in df:
        raise ValueError(f"unexpected columns {list(df.columns)}")
    s = pd.Series(
        pd.to_numeric(df[value_col], errors="coerce").values,
        index=pd.to_datetime(df["DATE"], format="%m/%d/%Y"),
    )
    s = s[s > 0]  # Cboe files contain occasional zero placeholders
    return s[~s.index.duplicated(keep="last")].sort_index()


def update(raw_dir: Path, cutoff: pd.Timestamp | None = None) -> SourceStatus:
    st = SourceStatus("cboe_indices", required=True)
    cutoff = cutoff if cutoff is not None else eod_cutoff()
    cols = {}
    for sym, (col, (lo, hi)) in SYMBOLS.items():
        s = cut(parse(get(URL.format(sym=sym)).text, col), cutoff)
        if sym in START:
            s = s[s.index >= START[sym]]
        s, nbad = drop_bad(s, lo, hi, sym)
        if nbad:
            st.warnings.append(f"{sym}: {nbad} out-of-range values removed")
        cols[sym] = s
    df = pd.DataFrame(cols).sort_index()
    path = raw_dir / CACHE
    cached = read_cache(path)
    st.revisions = reconcile(cached, df, list(SYMBOLS))
    if cached is not None:
        # Cboe's CDN sometimes serves a version of the file with today's value blank
        # (VIX for 2026-10-22 was 19.03 in one download and empty in the next): a
        # blank never overwrites a stored value; a real new value always wins.
        cols = [c for c in cached.columns if c in df.columns]
        blanks = int((df.reindex(cached.index)[cols].isna() & cached[cols].notna()).sum().sum())
        if blanks:
            st.warnings.append(f"{blanks} stored value(s) blank in this download; kept")
        df = df.combine_first(cached)[df.columns]
    st.reconciled_days = RECONCILE_BDAYS if cached is not None else 0
    safe_write(df, path, columns=list(SYMBOLS), rtol=1e-3)
    st.ok, st.rows, st.last_date = True, len(df), df.index[-1].date().isoformat()
    return st


def load(raw_dir: Path) -> pd.DataFrame:
    df = read_cache(raw_dir / CACHE)
    if df is None:
        raise FileNotFoundError(raw_dir / CACHE)
    return df
