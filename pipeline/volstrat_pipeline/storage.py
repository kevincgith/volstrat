"""Raw-cache persistence with the pipeline's core safety rules.

Raw caches are plain CSV so that daily commits produce small git deltas.
Rules enforced before any write:
  * never replace good data with empty, shorter or older data;
  * history that should be immutable must not silently change.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd


class DataGuardError(RuntimeError):
    """Raised when a write would degrade an existing dataset."""


def check_replacement(old: pd.DataFrame | None, new: pd.DataFrame) -> None:
    """Validate that `new` (indexed by date) may replace `old`.

    Rules: new must be non-empty, must not have fewer rows, and its last date
    must not be earlier than the old last date.
    """
    if new.empty:
        raise DataGuardError("refusing to write an empty dataset")
    if not isinstance(new.index, pd.DatetimeIndex):
        raise DataGuardError("dataset must be indexed by a DatetimeIndex")
    if not new.index.is_monotonic_increasing or new.index.has_duplicates:
        raise DataGuardError("dataset index must be strictly increasing")
    if old is None or old.empty:
        return
    if len(new) < len(old):
        raise DataGuardError(f"row count would shrink from {len(old)} to {len(new)}")
    if new.index[-1] < old.index[-1]:
        raise DataGuardError(
            f"last date would move backwards from {old.index[-1].date()} to {new.index[-1].date()}"
        )


def check_history_stable(
    old: pd.DataFrame | None,
    new: pd.DataFrame,
    columns: list[str],
    *,
    rtol: float = 1e-4,
    max_changed_frac: float = 0.01,
    returns: bool = False,
    returns_atol: float = 2e-5,
) -> None:
    """Fail if more than `max_changed_frac` of overlapping history changed.

    With `returns=True` the comparison is on daily percentage changes, which is
    the right test for dividend-adjusted prices (a new dividend rescales the
    whole adjusted history but leaves past returns intact). Returns are compared
    with an absolute tolerance (default 0.2 bp): Yahoo's re-rounded adjusted
    prices move past returns by up to ~3e-6, which a relative tolerance would
    flag for low-volatility assets such as T-bill ETFs.
    """
    if old is None or old.empty:
        return
    common = old.index.intersection(new.index)
    if len(common) < 2:
        return
    for col in columns:
        if col not in old or col not in new:
            continue
        a = old.loc[common, col].astype(float)
        b = new.loc[common, col].astype(float)
        if returns:
            a, b = a.pct_change().iloc[1:], b.pct_change().iloc[1:]
        both = a.notna() & b.notna()
        if both.sum() == 0:
            continue
        if returns:
            changed = ~np.isclose(a[both], b[both], rtol=0, atol=returns_atol)
        else:
            changed = ~np.isclose(a[both], b[both], rtol=rtol, atol=1e-8)
        frac = changed.mean()
        if frac > max_changed_frac:
            raise DataGuardError(
                f"{col}: {frac:.1%} of {both.sum()} overlapping values changed (limit "
                f"{max_changed_frac:.1%})"
            )


def read_cache(path: Path) -> pd.DataFrame | None:
    """Read a date-indexed CSV cache, or None if it does not exist."""
    if not path.exists():
        return None
    return pd.read_csv(path, index_col=0, parse_dates=[0])


def safe_write(df: pd.DataFrame, path: Path, **stable_kwargs) -> None:
    """Write `df` as CSV at `path` only if it passes the guard checks.

    `stable_kwargs` (columns=..., returns=..., ...) additionally runs
    `check_history_stable` against the existing file.
    """
    old = read_cache(path)
    check_replacement(old, df)
    if stable_kwargs:
        check_history_stable(old, df, **stable_kwargs)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    out = df.copy()
    out.index = out.index.strftime("%Y-%m-%d")
    out.index.name = "date"
    out.to_csv(tmp, float_format="%.10g")
    tmp.replace(path)


def stabilise_adjusted(
    old: pd.DataFrame | None,
    new: pd.DataFrame,
    *,
    adj_col: str = "adj_close",
    raw_col: str = "close",
    split_tol: float = 1e-3,
    refresh_tail: int = 5,
) -> pd.DataFrame:
    """Keep stored history byte-identical and chain only new rows onto it.

    Yahoo re-rounds its dividend-adjusted prices on every download, which would
    rewrite every line of every cache daily. Since only returns are used
    downstream, the stored adjusted series is kept and new rows are rescaled so
    that their returns match Yahoo's. If unadjusted closes disagree on the
    overlap (a split restated history), the new download is used as-is.
    The last `refresh_tail` stored days are always replaced by the new download
    so that late corrections to recent closes are picked up.
    """
    if old is None or old.empty:
        return new
    common = old.index.intersection(new.index)
    if len(common) == 0:
        return new
    ratio = (new.loc[common, raw_col] / old.loc[common, raw_col]).dropna()
    if len(ratio) and (ratio - 1).abs().max() > split_tol:
        return new  # split or other restatement of raw prices
    if len(common) <= refresh_tail:
        return new
    anchor = common[-(refresh_tail + 1)]  # last frozen day
    fresh = new[new.index > anchor].copy()
    scale = old.at[anchor, adj_col] / new.at[anchor, adj_col]
    fresh[adj_col] = fresh[adj_col] * scale
    # a day already stored (end-of-day) but missing from this download is a
    # vendor gap, not a deletion: keep the stored value
    kept = old[(old.index > anchor) & ~old.index.isin(fresh.index)]
    return pd.concat([old[old.index <= anchor], fresh, kept]).sort_index()


RECONCILE_BDAYS = 5  # "past week" re-checked on every run


def reconcile(
    old: pd.DataFrame | None,
    new: pd.DataFrame,
    columns: list[str],
    *,
    bdays: int = RECONCILE_BDAYS,
    rtol: float = 1e-6,
    atol: float = 1e-9,
) -> list[dict]:
    """Compare the last `bdays` stored days against a fresh download.

    Returns one record per changed value: {date, column, old, new}. Days the
    download lacks are reported with new = None. Used to surface vendor
    revisions of recent end-of-day values.
    """
    if old is None or old.empty or new.empty:
        return []
    last = old.index.max()
    start = last - pd.tseries.offsets.BDay(bdays - 1)
    out = []
    for d in old.index[old.index >= start]:
        for c in columns:
            if c not in old:
                continue
            a = old.at[d, c]
            if pd.isna(a):
                continue
            if d not in new.index or c not in new or pd.isna(new.at[d, c]):
                out.append(
                    {"date": d.date().isoformat(), "column": c, "old": float(a), "new": None}
                )
                continue
            b = new.at[d, c]
            if not np.isclose(float(a), float(b), rtol=rtol, atol=atol):
                out.append(
                    {"date": d.date().isoformat(), "column": c, "old": float(a), "new": float(b)}
                )
    return out
