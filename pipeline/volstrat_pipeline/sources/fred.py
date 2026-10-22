"""FRED series (credit spreads, financial-conditions indices).

Fetched keyless from fredgraph.csv, one request at a time; FRED blocks bursts
of parallel requests. If FRED_API_KEY is set the official API is used instead.
All FRED inputs are optional: a failure keeps the cached data and is reported
in meta.json, and the site falls back to proxies.
"""

from __future__ import annotations

import io
import logging
import os
import time
from pathlib import Path

import pandas as pd

from ..http import FetchError, get
from ..storage import DataGuardError, read_cache, safe_write
from .base import SourceStatus

log = logging.getLogger(__name__)

GRAPH_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id={sid}"
API_URL = (
    "https://api.stlouisfed.org/fred/series/observations?series_id={sid}"
    "&api_key={key}&file_type=json"
)
SERIES = {
    "BAMLH0A0HYM2": "ICE BofA US High Yield OAS (%)",
    "BAMLC0A0CM": "ICE BofA US Corporate (IG) OAS (%)",
    "BAA10Y": "Moody's Baa yield minus 10y Treasury (%)",
    "NFCI": "Chicago Fed National Financial Conditions Index (weekly)",
    "STLFSI4": "St. Louis Fed Financial Stress Index (weekly)",
}
CACHE = "fred.csv"


def parse_graph_csv(text: str) -> pd.Series:
    df = pd.read_csv(io.StringIO(text))
    df.columns = ["date", "value"]
    s = pd.Series(
        pd.to_numeric(df["value"], errors="coerce").values, index=pd.to_datetime(df["date"])
    )
    return s.dropna().sort_index()


def fetch(sid: str) -> pd.Series:
    key = os.environ.get("FRED_API_KEY")
    if key:
        obs = get(API_URL.format(sid=sid, key=key), timeout=60).json()["observations"]
        s = pd.Series(
            pd.to_numeric([o["value"] for o in obs], errors="coerce"),
            index=pd.to_datetime([o["date"] for o in obs]),
        )
        return s.dropna().sort_index()
    return parse_graph_csv(get(GRAPH_URL.format(sid=sid), timeout=60, retries=2).text)


def update(raw_dir: Path) -> list[SourceStatus]:
    path = raw_dir / CACHE
    cached = read_cache(path)
    cols, statuses = {}, []
    for sid in SERIES:
        st = SourceStatus(f"fred:{sid}", required=False)
        try:
            s = fetch(sid)
            if s.empty:
                raise FetchError("empty series")
            cols[sid] = s
            st.ok, st.rows, st.last_date = True, len(s), s.index[-1].date().isoformat()
        except (FetchError, ValueError, KeyError) as e:
            st.message = str(e)[:200]
            log.warning("FRED %s failed: %s", sid, st.message)
            if cached is not None and sid in cached and cached[sid].notna().any():
                cols[sid] = cached[sid].dropna()
                st.rows = int(cached[sid].notna().sum())
                st.last_date = cached[sid].dropna().index[-1].date().isoformat()
                st.warnings.append("using cached data")
        statuses.append(st)
        time.sleep(1.5)
    if cols:
        df = pd.DataFrame(cols).sort_index()
        try:
            safe_write(df, path, columns=list(cols), rtol=1e-3, max_changed_frac=0.05)
        except DataGuardError as e:
            for st in statuses:
                st.warnings.append(f"cache not updated: {e}")
    return statuses


def load(raw_dir: Path) -> pd.DataFrame | None:
    return read_cache(raw_dir / CACHE)
