"""Common types for source fetchers."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field

import pandas as pd

# Data for day D is only treated as end-of-day once New York time has passed
# this hour on D (16:00 close + closing auction, Cboe/CFE settlement files and
# Yahoo corrections typically land by then).
EOD_HOUR_ET = 18


def eod_cutoff(now: pd.Timestamp | None = None) -> pd.Timestamp:
    """Latest date whose prices can be trusted as final end-of-day values.

    Before 18:00 New York time the current day is still provisional (or live),
    so the cutoff is the previous business day.
    """
    now = now if now is not None else pd.Timestamp.now(tz="America/New_York")
    if now.tzinfo is None:
        now = now.tz_localize("America/New_York")
    now = now.tz_convert("America/New_York")
    day = now.tz_localize(None).normalize()
    if now.hour < EOD_HOUR_ET:
        day -= pd.Timedelta(days=1)
    while day.weekday() >= 5:  # roll weekends back to Friday
        day -= pd.Timedelta(days=1)
    return day


def cut(x, cutoff: pd.Timestamp):
    """Drop rows dated after `cutoff` (works for Series and DataFrames)."""
    return x[x.index <= cutoff]


@dataclass
class SourceStatus:
    """Outcome of one source update, reported in data/site/meta.json."""

    name: str
    required: bool
    ok: bool = False
    last_date: str | None = None
    rows: int = 0
    message: str = ""
    warnings: list[str] = field(default_factory=list)
    # past-week values that differ between the stored copy and today's download
    revisions: list[dict] = field(default_factory=list)
    reconciled_days: int = 0

    def to_dict(self) -> dict:
        return asdict(self)


def drop_bad(series, lo: float, hi: float, name: str, max_frac: float = 0.002):
    """Null out values outside [lo, hi]; raise if more than `max_frac` are bad.

    Returns (cleaned_series, number_of_values_removed).
    """
    s = series.astype(float)
    bad = s.notna() & ((s < lo) | (s > hi))
    n = int(bad.sum())
    if n and n / max(s.notna().sum(), 1) > max_frac:
        raise ValueError(f"{name}: {n} values outside [{lo}, {hi}] - schema change?")
    return s.mask(bad), n
