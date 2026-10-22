"""US Treasury daily par yield curve (home.treasury.gov), 1990 onwards.

Primary source for the 3-month bill (cash yield) and the 10y-2y slope.
Past years are immutable and fetched once; the current and previous year are
refreshed each run.
"""

from __future__ import annotations

import io
import logging
from pathlib import Path

import pandas as pd

from ..http import get
from ..storage import read_cache, safe_write
from .base import SourceStatus, drop_bad

log = logging.getLogger(__name__)

URL = (
    "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/"
    "daily-treasury-rates.csv/{y}/all?type=daily_treasury_yield_curve"
    "&field_tdr_date_value={y}&page&_format=csv"
)
FIRST_YEAR = 1990
CACHE = "treasury_curve.csv"
KEEP = {"1 Mo": "y1m", "3 Mo": "y3m", "6 Mo": "y6m", "1 Yr": "y1y", "2 Yr": "y2y",
        "5 Yr": "y5y", "10 Yr": "y10y", "30 Yr": "y30y"}  # fmt: skip


def parse(text: str) -> pd.DataFrame:
    df = pd.read_csv(io.StringIO(text))
    df.columns = [c.strip().strip('"') for c in df.columns]
    if "Date" not in df:
        raise ValueError(f"unexpected Treasury columns {list(df.columns)[:5]}")
    out = pd.DataFrame(index=pd.to_datetime(df["Date"], format="%m/%d/%Y"))
    for src, dst in KEEP.items():
        out[dst] = pd.to_numeric(df[src], errors="coerce").values if src in df else float("nan")
    return out.sort_index()


def update(raw_dir: Path, today: pd.Timestamp | None = None) -> SourceStatus:
    st = SourceStatus("treasury_curve", required=True)
    path = raw_dir / CACHE
    cached = read_cache(path)
    year = (today or pd.Timestamp.now()).year
    years = range(FIRST_YEAR, year + 1) if cached is None else range(year - 1, year + 1)
    frames = [parse(get(URL.format(y=y), timeout=90).text) for y in years]
    new = pd.concat(frames)
    if cached is not None:
        new = new.combine_first(cached)
    new = new[~new.index.duplicated(keep="first")].sort_index()
    for c in KEEP.values():
        new[c], n = drop_bad(new[c], -1.5, 25, c)
        if n:
            st.warnings.append(f"{c}: {n} implausible values removed")
    safe_write(new, path, columns=["y3m", "y2y", "y10y"], rtol=1e-3)
    st.ok, st.rows, st.last_date = True, len(new), new.index[-1].date().isoformat()
    return st


def load(raw_dir: Path) -> pd.DataFrame | None:
    return read_cache(raw_dir / CACHE)
