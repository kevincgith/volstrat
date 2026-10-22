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
