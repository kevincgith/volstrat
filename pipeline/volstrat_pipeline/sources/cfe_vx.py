"""Cboe Futures Exchange (CFE) VIX futures daily settlements, monthly contracts.

Two sources are combined:
  * legacy archive, one CSV per contract, used for contracts expiring <= 2013;
  * current feed (contract list JSON + one CSV per contract) for 2014 onwards.
The current feed's 2013 rows carry Settle = 0 until 2013-05-17, which is why
2013 contracts come from the archive.

Quirks handled here:
  * prices before 2007-03-26 are quoted at 10x the index (pre-redenomination);
  * a few archive rows carry an extra trailing field.

Cache: data/raw/vx_contracts.csv in long format (date, expiry, ...).
"""

from __future__ import annotations

import csv
import io
import logging
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pandas as pd

from ..http import get
from ..storage import DataGuardError
from .base import SourceStatus, eod_cutoff

log = logging.getLogger(__name__)

LIST_URL = "https://www.cboe.com/us/futures/market_statistics/historical_data/product/list/VX/"
CDN = "https://cdn.cboe.com/"
ARCHIVE_URL = (
    "https://cdn.cboe.com/resources/futures/archive/volume-and-price/CFE_{code}{yy:02d}_VX.csv"
)
MONTH_CODES = "FGHJKMNQUVXZ"
ARCHIVE_LAST_YEAR = 2013
RESCALE_BEFORE = pd.Timestamp("2007-03-26")
CACHE = "vx_contracts.csv"
COLUMNS = ["expiry", "open", "high", "low", "close", "settle", "volume", "open_interest", "src"]


def parse_contract_csv(text: str) -> tuple[pd.DataFrame, int]:
    """Parse one contract file (either feed). Returns (frame, malformed_rows_dropped)."""
    rows = list(csv.reader(io.StringIO(text)))
    # some files start with a disclaimer line before the header
    start = next((i for i, r in enumerate(rows[:5]) if r and r[0].strip() == "Trade Date"), None)
    if start is None:
        return pd.DataFrame(), 0
    rows = rows[start:]
    header = [h.strip() for h in rows[0]]
    n = len(header)
    good, dropped = [], 0
    for r in rows[1:]:
        if not r:
            continue
        if len(r) > n and all(not x.strip() for x in r[n:]):
            r = r[:n]
        if len(r) != n:
            dropped += 1
            continue
        good.append(r)
    df = pd.DataFrame(good, columns=header)
    out = pd.DataFrame(
        {
            "date": pd.to_datetime(df["Trade Date"], format="mixed"),
            "open": pd.to_numeric(df["Open"], errors="coerce"),
            "high": pd.to_numeric(df["High"], errors="coerce"),
            "low": pd.to_numeric(df["Low"], errors="coerce"),
            "close": pd.to_numeric(df["Close"], errors="coerce"),
            "settle": pd.to_numeric(df["Settle"], errors="coerce"),
            "volume": pd.to_numeric(df["Total Volume"], errors="coerce"),
            "open_interest": pd.to_numeric(df["Open Interest"], errors="coerce"),
        }
    )
    return out, dropped


def normalise(df: pd.DataFrame, expiry: pd.Timestamp, src: str) -> pd.DataFrame:
    """Drop placeholder rows, fix the pre-2007 x10 scale and attach the expiry."""
    df = df[df["settle"] > 0].copy()
    old = df["date"] < RESCALE_BEFORE
    for c in ("open", "high", "low", "close", "settle"):
        df.loc[old, c] = df.loc[old, c] / 10.0
    df["expiry"] = expiry
    df["src"] = src
    return df.drop_duplicates("date", keep="last")


def _fetch_archive(code: str, year: int) -> pd.DataFrame | None:
    r = get(ARCHIVE_URL.format(code=code, yy=year % 100), missing_ok=(403, 404))
    if r is None:
        return None
    df, dropped = parse_contract_csv(r.text)
    if dropped:
        log.info("archive %s%d: dropped %d malformed rows", code, year, dropped)
    if df.empty:
        return None
    # The archive files end on the final settlement date, i.e. the expiry.
    expiry = df.loc[df["settle"] > 0, "date"].max()
    return normalise(df, expiry, "archive")


def _fetch_current(path: str, expiry: str) -> pd.DataFrame | None:
    r = get(CDN + path, missing_ok=(403, 404))
    if r is None:
        return None
    df, _ = parse_contract_csv(r.text)
    return normalise(df, pd.Timestamp(expiry), "current") if not df.empty else None


def load(raw_dir: Path) -> pd.DataFrame | None:
    path = raw_dir / CACHE
    if not path.exists():
        return None
    return pd.read_csv(path, parse_dates=["date", "expiry"])


def update(raw_dir: Path, workers: int = 8, cutoff: pd.Timestamp | None = None) -> SourceStatus:
    st = SourceStatus("cfe_vx", required=True)
    cutoff = cutoff if cutoff is not None else eod_cutoff()
    cached = load(raw_dir)
    have = set() if cached is None else set(cached["expiry"].dt.date)
    last_cached = None if cached is None else cached["date"].max()

    jobs = []
    # Legacy archive: immutable, fetched once per contract.
    if cached is None or not (cached["src"] == "archive").any():
        for year in range(2004, ARCHIVE_LAST_YEAR + 1):
            for code in MONTH_CODES:
                jobs.append(("archive", code, year))
    # Current feed: new contracts plus any contract still trading.
    listing = get(LIST_URL).json()
    for contracts in listing.values():
        for c in contracts:
            if c.get("duration_type") != "M":
                continue
            exp = pd.Timestamp(c["expire_date"])
            if exp.year <= ARCHIVE_LAST_YEAR:
                continue
            live = last_cached is None or exp >= last_cached - pd.Timedelta(days=7)
            if exp.date() not in have or live:
                jobs.append(("current", c["path"], c["expire_date"]))

    def run(job):
        if job[0] == "archive":
            return _fetch_archive(job[1], job[2])
        return _fetch_current(job[1], job[2])

    with ThreadPoolExecutor(workers) as ex:
        frames = [f for f in ex.map(run, jobs) if f is not None]

    fresh = pd.concat(frames) if frames else pd.DataFrame(columns=["date", *COLUMNS])
    # settlements dated after the end-of-day cutoff may be provisional
    if len(fresh):
        fresh = fresh[fresh["date"] <= cutoff]
    if cached is not None and len(fresh):
        # reconcile the past week's settlements, contract by contract
        lo = cached["date"].max() - pd.tseries.offsets.BDay(4)
        a = cached[cached["date"] >= lo].set_index(["date", "expiry"])["settle"]
        b = fresh.set_index(["date", "expiry"])["settle"]
        both = a.index.intersection(b.index)
        changed = [(d, e) for (d, e) in both if abs(a[(d, e)] - b[(d, e)]) > 1e-9]
        st.revisions = [
            {
                "date": d.date().isoformat(),
                "column": f"VX settle exp {e.date()}",
                "old": float(a[(d, e)]),
                "new": float(b[(d, e)]),
            }
            for (d, e) in changed
        ]
        st.reconciled_days = 5
    if cached is not None:
        refreshed = set(fresh["expiry"].dt.date) if len(fresh) else set()
        keep = cached[~cached["expiry"].dt.date.isin(refreshed)]
        combined = pd.concat([keep, fresh])
    else:
        combined = fresh
    combined = combined.sort_values(["date", "expiry"]).reset_index(drop=True)

    # Guard: never shrink or move backwards.
    if combined.empty:
        raise DataGuardError("VX: no contract data")
    if cached is not None:
        if len(combined) < len(cached):
            raise DataGuardError(f"VX rows would shrink {len(cached)} -> {len(combined)}")
        if combined["date"].max() < cached["date"].max():
            raise DataGuardError("VX last date would move backwards")
    per_day = combined.groupby("date").size()
    thin = per_day[(per_day < 2) & (per_day.index > "2006-01-01")]
    if len(thin):
        st.warnings.append(f"{len(thin)} days with <2 live contracts after 2006")

    out = combined[["date", *COLUMNS]].copy()
    out["date"] = out["date"].dt.strftime("%Y-%m-%d")
    out["expiry"] = pd.to_datetime(out["expiry"]).dt.strftime("%Y-%m-%d")
    tmp = raw_dir / (CACHE + ".tmp")
    out.to_csv(tmp, index=False, float_format="%.6g")
    tmp.replace(raw_dir / CACHE)
    st.ok, st.rows = True, len(out)
    st.last_date = combined["date"].max().date().isoformat()
    return st
