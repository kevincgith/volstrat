import pandas as pd
import pytest

from volstrat_pipeline.storage import DataGuardError, check_replacement, safe_write


def frame(start: str, n: int) -> pd.DataFrame:
    idx = pd.bdate_range(start, periods=n)
    return pd.DataFrame({"close": range(n)}, index=idx, dtype=float)


def test_first_write_allowed(tmp_path):
    path = tmp_path / "x.parquet"
    safe_write(frame("2024-01-01", 5), path)
    assert len(pd.read_parquet(path)) == 5


def test_empty_write_rejected_and_old_data_kept(tmp_path):
    path = tmp_path / "x.parquet"
    safe_write(frame("2024-01-01", 5), path)
    with pytest.raises(DataGuardError, match="empty"):
        safe_write(frame("2024-01-01", 0), path)
    assert len(pd.read_parquet(path)) == 5


def test_shrinking_rejected():
    with pytest.raises(DataGuardError, match="shrink"):
        check_replacement(frame("2024-01-01", 10), frame("2024-01-01", 9))


def test_last_date_backwards_rejected():
    old = frame("2024-01-01", 10)
    new = frame("2023-12-01", 10)  # same length, ends earlier
    with pytest.raises(DataGuardError, match="backwards"):
        check_replacement(old, new)


def test_unsorted_index_rejected():
    df = frame("2024-01-01", 5).iloc[::-1]
    with pytest.raises(DataGuardError, match="increasing"):
        check_replacement(None, df)


def test_incremental_append_allowed():
    check_replacement(frame("2024-01-01", 10), frame("2024-01-01", 11))
