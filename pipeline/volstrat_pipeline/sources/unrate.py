"""US unemployment rate (BLS LNS14000000 = FRED UNRATE), monthly, seasonally adjusted.

Used by the recession gate (docs/PREREG-v13.md, METHODOLOGY §25). FRED's keyless endpoint
is tried first for the full history; when it fails (it often times out, see fred.py), the
BLS public API supplies the latest three years, which are merged into the cache. Seasonal
factors are revised every January for the last five years, so recent values can change;
the cache guard allows that.

The cache was seeded on 2026-11-05 from the BLS series (DBnomics mirror to 2025-01, BLS API
after). 2025-10 is missing: it was not collected during the federal government shutdown.
"""

from __future__ import annotations

import logging
from pathlib import Path

import pandas as pd

from ..http import FetchError, get
from ..storage import DataGuardError, read_cache, safe_write
from .base import SourceStatus, cut, eod_cutoff
from .fred import parse_graph_csv

log = logging.getLogger(__name__)

CACHE = "unrate.csv"
FRED_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=UNRATE"
BLS_URL = "https://api.bls.gov/publicAPI/v1/timeseries/data/LNS14000000?startyear={a}&endyear={b}"


def parse_bls(payload: dict) -> pd.Series:
    """Monthly values from a BLS API v1 response (M13 annual averages and blanks dropped)."""
    if payload.get("status") != "REQUEST_SUCCEEDED":
        raise FetchError(f"BLS API: {payload.get('status')} {payload.get('message')}")
    rows = payload["Results"]["series"][0]["data"]
    obs = {
        pd.Timestamp(f"{r['year']}-{r['period'][1:]}-01"): float(r["value"])
        for r in rows
        if r["period"].startswith("M") and r["period"] != "M13" and r["value"] not in ("-", "")
    }
    return pd.Series(obs, dtype=float).sort_index()


def fetch(today: pd.Timestamp) -> tuple[pd.Series, str]:
    try:
        return parse_graph_csv(get(FRED_URL, timeout=20, retries=1).text), "FRED UNRATE"
    except (FetchError, ValueError, KeyError) as e:
        log.warning("FRED UNRATE failed (%s); falling back to the BLS API", str(e)[:120])
    y = today.year
    return parse_bls(get(BLS_URL.format(a=y - 2, b=y), timeout=30, retries=1).json()), "BLS API"


def update(raw_dir: Path, cutoff: pd.Timestamp | None = None) -> list[SourceStatus]:
    cutoff = cutoff if cutoff is not None else eod_cutoff()
    path = raw_dir / CACHE
    cached = read_cache(path)
    st = SourceStatus("unrate", required=False)
    try:
        new, src = fetch(cutoff)
        new = cut(new, cutoff)
        if new.empty:
            raise FetchError("empty series")
        old = cached["UNRATE"].dropna() if cached is not None and "UNRATE" in cached else None
        # a full FRED history replaces the cache; a BLS three-year window updates its months
        s = new if old is None or src == "FRED UNRATE" else new.combine_first(old)
        if old is not None and src != "FRED UNRATE":
            s.loc[new.index] = new
        s = s.sort_index()
        try:
            safe_write(
                s.to_frame("UNRATE"), path, columns=["UNRATE"], rtol=1e-3, max_changed_frac=0.1
            )
        except DataGuardError as e:
            st.warnings.append(f"cache not updated: {e}")
        st.ok, st.rows, st.last_date = True, len(s), s.index[-1].date().isoformat()
        st.warnings.append(f"source: {src}")
    except (FetchError, ValueError, KeyError) as e:
        st.message = str(e)[:200]
        log.warning("unemployment rate failed: %s", st.message)
        if cached is not None and "UNRATE" in cached and cached["UNRATE"].notna().any():
            s = cached["UNRATE"].dropna()
            st.rows, st.last_date = len(s), s.index[-1].date().isoformat()
            st.warnings.append("using cached data")
    return [st]


def load(raw_dir: Path) -> pd.DataFrame | None:
    return read_cache(raw_dir / CACHE)


def gap(unrate: pd.Series, months: int = 12) -> pd.Series:
    """Latest rate minus the average of the latest `months` available observations.

    Indexed by the month the latest value describes; observation-based, so a month that was
    never published (2025-10) is skipped rather than filled.
    """
    s = unrate.dropna().sort_index()
    return (s - s.rolling(months, min_periods=months).mean()).dropna()
