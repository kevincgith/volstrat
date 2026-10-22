"""Point-in-time alignment of source series onto the trading calendar.

Every series is placed on the date its value was *available*, not the date it
describes. A Friday-dated weekly index published the next Wednesday only
becomes visible on Wednesday. Without this the backtest would have
look-ahead bias.
"""

from __future__ import annotations

import pandas as pd
from pandas.tseries.offsets import BDay


def availability_dates(index: pd.DatetimeIndex, lag_bdays: int = 0, lag_days: int = 0):
    """Date on which each observation becomes known."""
    out = index
    if lag_days:
        out = out + pd.Timedelta(days=lag_days)
    if lag_bdays:
        out = out + BDay(lag_bdays)
    return out


def as_of(
    s: pd.Series,
    calendar: pd.DatetimeIndex,
    *,
    lag_bdays: int = 0,
    lag_days: int = 0,
    max_stale_days: int = 7,
) -> pd.Series:
    """Value known at each calendar date: the latest observation whose
    availability date is <= that date, and which is at most `max_stale_days`
    calendar days old (by availability)."""
    s = s.dropna().sort_index()
    if s.empty:
        return pd.Series(float("nan"), index=calendar)
    avail = availability_dates(s.index, lag_bdays, lag_days)
    left = pd.DataFrame({"date": calendar})
    right = pd.DataFrame({"date": avail, "value": s.values, "avail": avail})
    right = right.drop_duplicates("date", keep="last")
    m = pd.merge_asof(left, right, on="date", direction="backward")
    stale = (m["date"] - m["avail"]).dt.days > max_stale_days
    m.loc[stale, "value"] = float("nan")
    return pd.Series(m["value"].values, index=calendar, name=s.name)


def master_calendar(gspc: pd.DataFrame, start: str = "1990-01-02") -> pd.DatetimeIndex:
    """NYSE trading days, taken from the S&P 500 index history."""
    idx = gspc.index[gspc.index >= start]
    return pd.DatetimeIndex(idx.unique().sort_values(), name="date")
