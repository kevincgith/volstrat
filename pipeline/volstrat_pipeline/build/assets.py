"""Total-return series for tradeable assets, extended before ETF inception.

Each asset is a chain of segments, newest first. On every date the return comes
from the highest-priority segment that has data. Returns are chained into an
index that starts at 1.0, so past values do not move when Yahoo re-adjusts
for new dividends.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

TRADING_DAYS = 252


@dataclass
class Segment:
    source: str  # e.g. "SPY", "^SP500TR", "cash"
    label: str
    synthetic: bool = False  # True for proxies (anything that is not the asset itself)
    start: str | None = (
        None  # ignore this source's prices before this date (unreliable early prints)
    )


@dataclass
class AssetSpec:
    key: str
    label: str
    group: str  # "risk", "defensive", "proxy"
    segments: list[Segment] = field(default_factory=list)
    expense_ratio: float = 0.0  # informational: ETF returns are already net of it


def chain_returns(
    returns: list[pd.Series], calendar: pd.DatetimeIndex
) -> tuple[pd.Series, pd.Series]:
    """Combine return series by priority (first = highest).

    The highest-priority series is used from its first valid date onwards; each
    lower-priority series only fills dates *before* the start of every
    higher-priority one (no back-and-forth switching on isolated gaps).
    Returns (daily returns, segment index used per date; -1 = none).
    """
    r = pd.Series(np.nan, index=calendar)
    seg = pd.Series(-1, index=calendar)
    cutoff = None  # first date covered by a higher-priority segment
    for i, s in enumerate(returns):
        s = s.reindex(calendar)
        valid = s.notna()
        if cutoff is not None:
            valid &= calendar < cutoff
        take = valid & r.isna()
        r[take] = s[take]
        seg[take] = i
        first = s.first_valid_index()
        if first is not None:
            cutoff = first if cutoff is None else min(cutoff, first)
    return r, seg


def to_index(returns: pd.Series) -> pd.Series:
    """Cumulative total-return index starting at 1.0 on the first valid date."""
    first = returns.first_valid_index()
    out = pd.Series(np.nan, index=returns.index)
    if first is None:
        return out
    r = returns.loc[first:].fillna(0.0)
    r.iloc[0] = 0.0  # the index starts at 1.0, the first day's return is not earned
    out.loc[first:] = (1.0 + r).cumprod()
    return out


def price_returns(px: pd.Series, calendar: pd.DatetimeIndex, max_gap: int = 5) -> pd.Series:
    """Daily returns on the calendar; short gaps are forward-filled (zero return)."""
    s = px.dropna()
    s = s[~s.index.duplicated(keep="last")]
    s = s.reindex(calendar.union(s.index)).ffill(limit=max_gap).reindex(calendar)
    r = s.pct_change(fill_method=None)
    r[s.index < px.first_valid_index()] = np.nan
    return r


def cash_returns(yield_pct: pd.Series, calendar: pd.DatetimeIndex) -> pd.Series:
    """Daily T-bill accrual: previous day's annualised yield x calendar days / 360."""
    y = yield_pct.reindex(calendar).ffill(limit=10)
    days = pd.Series(calendar, index=calendar).diff().dt.days
    return (y.shift(1) / 100.0) * days / 360.0


def segments_meta(seg: pd.Series, spec: AssetSpec) -> list[dict]:
    """Contiguous runs of the segment indicator, for chart shading."""
    out = []
    s = seg[seg >= 0]
    if s.empty:
        return out
    run_start, cur = s.index[0], s.iloc[0]
    prev = s.index[0]
    for d, v in s.iloc[1:].items():
        if v != cur:
            out.append((run_start, prev, cur))
            run_start, cur = d, v
        prev = d
    out.append((run_start, prev, cur))
    return [
        {
            "from": a.date().isoformat(),
            "to": b.date().isoformat(),
            "source": spec.segments[int(i)].source,
            "label": spec.segments[int(i)].label,
            "synthetic": spec.segments[int(i)].synthetic,
        }
        for a, b, i in out
    ]
