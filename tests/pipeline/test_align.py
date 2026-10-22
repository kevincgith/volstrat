import math

import pandas as pd

from volstrat_pipeline.build.align import as_of

CAL = pd.bdate_range("2024-01-01", "2024-01-31")


def test_same_day_series_unchanged():
    s = pd.Series([1.0, 2.0], index=pd.to_datetime(["2024-01-02", "2024-01-03"]))
    a = as_of(s, CAL)
    assert a["2024-01-02"] == 1.0 and a["2024-01-03"] == 2.0
    assert math.isnan(a["2024-01-01"])


def test_one_business_day_lag():
    # value dated Friday 5 Jan is first usable on Monday 8 Jan
    s = pd.Series([1.0, 9.0], index=pd.to_datetime(["2024-01-04", "2024-01-05"]))
    a = as_of(s, CAL, lag_bdays=1)
    assert a["2024-01-05"] == 1.0
    assert a["2024-01-08"] == 9.0


def test_weekly_publication_lag():
    # NFCI-style: Friday-dated value published the following Wednesday (+5 days)
    s = pd.Series([0.5], index=pd.to_datetime(["2024-01-05"]))
    a = as_of(s, CAL, lag_days=5, max_stale_days=14)
    assert math.isnan(a["2024-01-09"])  # Tuesday: not yet published
    assert a["2024-01-10"] == 0.5  # Wednesday
    assert a["2024-01-24"] == 0.5  # 14 days after availability
    assert math.isnan(a["2024-01-25"])  # stale


def test_future_values_never_visible():
    s = pd.Series(range(len(CAL)), index=CAL, dtype=float)
    for lag in (0, 1, 3):
        a = as_of(s, CAL, lag_bdays=lag)
        for i, d in enumerate(CAL):
            if not math.isnan(a[d]):
                assert a[d] <= i - lag
