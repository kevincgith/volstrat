import pandas as pd
import pytest

from volstrat_pipeline.storage import (
    DataGuardError,
    check_history_stable,
    check_replacement,
    read_cache,
    safe_write,
    stabilise_adjusted,
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


def adj_frame(start: str, n: int, scale: float = 1.0) -> pd.DataFrame:
    idx = pd.bdate_range(start, periods=n)
    close = pd.Series([100.0 + i for i in range(n)], index=idx)
    return pd.DataFrame({"close": close, "adj_close": close * 0.9 * scale})


def test_stabilise_keeps_history_and_chains_new_rows():
    old = adj_frame("2024-01-01", 20)
    new = adj_frame("2024-01-01", 22, scale=0.97)  # re-adjusted after a dividend + 2 new days
    out = stabilise_adjusted(old, new, refresh_tail=5)
    pd.testing.assert_frame_equal(out.iloc[:15], old.iloc[:15])  # frozen history untouched
    # refreshed tail and new rows keep Yahoo's returns
    r_new = new["adj_close"].pct_change().iloc[15:]
    r_out = out["adj_close"].pct_change().iloc[15:]
    assert (r_new - r_out).abs().max() < 1e-12
    assert len(out) == 22


def test_stabilise_picks_up_corrections_in_recent_days():
    old = adj_frame("2024-01-01", 20)
    new = adj_frame("2024-01-01", 20)
    new.iloc[-1, :] *= 1.0005  # yesterday's provisional close was corrected
    out = stabilise_adjusted(old, new, refresh_tail=5)
    assert out["close"].iloc[-1] == new["close"].iloc[-1]


def test_stabilise_takes_new_history_after_a_split():
    old = adj_frame("2024-01-01", 20)
    new = adj_frame("2024-01-01", 21)
    new[["close", "adj_close"]] /= 2  # 2-for-1 split restates history
    out = stabilise_adjusted(old, new)
    pd.testing.assert_frame_equal(out, new)


def test_stabilise_keeps_stored_day_missing_from_download():
    old = adj_frame("2024-01-01", 20)
    new = adj_frame("2024-01-01", 20).iloc[:-1]  # vendor returned a blank for the last stored day
    out = stabilise_adjusted(old, new, refresh_tail=5)
    assert len(out) == 20
    assert out.index[-1] == old.index[-1]
    assert out["close"].iloc[-1] == old["close"].iloc[-1]


def test_reconcile_reports_past_week_revisions_only():
    from volstrat_pipeline.storage import reconcile

    old = adj_frame("2024-01-01", 20)
    new = old.copy()
    new.iloc[2, 0] += 1.0  # revision 18 days back: outside the 5-day window, not reported
    new.iloc[-2, 0] += 0.5  # revision yesterday-1: reported
    new = new.drop(new.index[-1])  # latest stored day missing from the download: reported
    revs = reconcile(old, new, ["close"], bdays=5)
    dates = {r["date"]: r for r in revs}
    assert len(revs) == 2
    assert dates[str(old.index[-2].date())]["new"] == old["close"].iloc[-2] + 0.5
    assert dates[str(old.index[-1].date())]["new"] is None
    assert reconcile(old, old, ["close"]) == []


def test_stabilise_ignores_rounding_noise_in_tail():
    old = adj_frame("2024-01-01", 20)
    new = old.copy()
    new.iloc[-3:, 1] *= 1 + 4e-9  # vendor re-rounding of recent adjusted closes
    out = stabilise_adjusted(old, new, refresh_tail=5)
    pd.testing.assert_frame_equal(out, old)  # byte-identical: nothing to commit
