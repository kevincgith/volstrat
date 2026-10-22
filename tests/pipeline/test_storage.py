import pandas as pd
import pytest

from volstrat_pipeline.storage import (
    DataGuardError,
    check_history_stable,
    check_replacement,
    read_cache,
    safe_write,
)


def frame(start: str, n: int, mult: float = 1.0) -> pd.DataFrame:
    idx = pd.bdate_range(start, periods=n)
    return pd.DataFrame({"close": [100.0 + i * mult for i in range(n)]}, index=idx)


def test_first_write_and_roundtrip(tmp_path):
    path = tmp_path / "x.csv"
    safe_write(frame("2024-01-01", 5), path)
    back = read_cache(path)
    assert len(back) == 5 and isinstance(back.index, pd.DatetimeIndex)


def test_empty_write_rejected_and_old_data_kept(tmp_path):
    path = tmp_path / "x.csv"
    safe_write(frame("2024-01-01", 5), path)
    with pytest.raises(DataGuardError, match="empty"):
        safe_write(frame("2024-01-01", 0), path)
    assert len(read_cache(path)) == 5


def test_shrinking_rejected():
    with pytest.raises(DataGuardError, match="shrink"):
        check_replacement(frame("2024-01-01", 10), frame("2024-01-01", 9))


def test_last_date_backwards_rejected():
    with pytest.raises(DataGuardError, match="backwards"):
        check_replacement(frame("2024-01-01", 10), frame("2023-12-01", 10))


def test_unsorted_index_rejected():
    with pytest.raises(DataGuardError, match="increasing"):
        check_replacement(None, frame("2024-01-01", 5).iloc[::-1])


def test_incremental_append_allowed():
    check_replacement(frame("2024-01-01", 10), frame("2024-01-01", 11))


def test_history_change_detected():
    old = frame("2024-01-01", 100)
    new = old.copy()
    new.iloc[:50, 0] *= 1.10  # half the history rewritten
    with pytest.raises(DataGuardError, match="changed"):
        check_history_stable(old, new, ["close"])


def test_dividend_rescale_passes_on_returns():
    old = frame("2024-01-01", 100)
    new = old * 0.98  # whole adjusted history rescaled by a new dividend
    with pytest.raises(DataGuardError):
        check_history_stable(old, new, ["close"])
    check_history_stable(old, new, ["close"], returns=True)


def test_rounding_noise_in_adjusted_returns_passes():
    import numpy as np

    old = frame("2024-01-01", 200, mult=0.001)  # T-bill-like: tiny daily returns
    rng = np.random.default_rng(0)
    new = old * (1 + rng.normal(0, 2e-6, size=(200, 1)))  # ~0.02bp re-rounding noise
    check_history_stable(old, new, ["close"], returns=True)
    bad = old.copy()
    bad.iloc[::5, 0] *= 1.001  # 10bp restatements on 20% of days
    with pytest.raises(DataGuardError):
        check_history_stable(old, bad, ["close"], returns=True)
