"""Raw-cache persistence with the pipeline's core safety rule:
never replace good data with empty, shorter or older data."""

from __future__ import annotations

from pathlib import Path

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


def safe_write(df: pd.DataFrame, path: Path) -> None:
    """Write `df` to parquet at `path` only if it passes `check_replacement`."""
    old = pd.read_parquet(path) if path.exists() else None
    check_replacement(old, df)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    df.to_parquet(tmp)
    tmp.replace(path)
