import math

import numpy as np
import pandas as pd

from volstrat_pipeline.build.assets import (
    AssetSpec,
    Segment,
    cash_returns,
    chain_returns,
    price_returns,
    segments_meta,
    to_index,
)

CAL = pd.bdate_range("2024-01-01", periods=10)


def test_chain_uses_extension_only_before_primary_starts():
    primary = pd.Series([np.nan] * 5 + [0.01] * 5, index=CAL)
    primary.iloc[7] = np.nan  # an isolated gap must NOT switch back to the extension
    ext = pd.Series([0.02] * 10, index=CAL)
    r, seg = chain_returns([primary, ext], CAL)
    assert (r.iloc[:5] == 0.02).all() and (seg.iloc[:5] == 1).all()
    assert math.isnan(r.iloc[7]) and seg.iloc[7] == -1
    assert r.iloc[9] == 0.01 and seg.iloc[9] == 0


def test_splice_has_no_level_jump():
    # primary prices start on day 5; extension returns fill days 1-5
    px = pd.Series([np.nan] * 5 + [50, 51, 52, 53, 54], index=CAL, dtype=float)
    ext = pd.Series([0.0] + [0.01] * 9, index=CAL)
    r, _ = chain_returns([price_returns(px, CAL), ext], CAL)
    idx = to_index(r)
    assert idx.iloc[0] == 1.0
    assert math.isclose(idx.iloc[4], 1.01**4)
    assert math.isclose(idx.iloc[5], 1.01**5)  # first primary price day: extension return
    assert math.isclose(idx.iloc[6] / idx.iloc[5], 51 / 50)


def test_index_unaffected_by_adjusted_price_rescale():
    px = pd.Series(np.linspace(100, 110, 10), index=CAL)
    a = to_index(price_returns(px, CAL))
    b = to_index(price_returns(px * 0.97, CAL))
    assert np.allclose(a, b, equal_nan=True)


def test_cash_uses_previous_day_yield():
    y = pd.Series([5.0] * 5 + [10.0] * 5, index=CAL)
    r = cash_returns(y, CAL)
    assert math.isnan(r.iloc[0])
    assert math.isclose(r.iloc[1], 0.05 / 360)  # Tue: 1 day at Monday's 5%
    assert math.isclose(r.iloc[5], 0.05 * 3 / 360)  # Mon: weekend accrual at Friday's 5%
    assert math.isclose(r.iloc[6], 0.10 / 360)


def test_segments_meta_runs():
    spec = AssetSpec("X", "x", "risk", [Segment("A", "a"), Segment("B", "b", True)])
    seg = pd.Series([-1, 1, 1, 0, 0], index=CAL[:5])
    m = segments_meta(seg, spec)
    assert [(s["source"], s["synthetic"]) for s in m] == [("B", True), ("A", False)]
    assert m[0]["from"] == "2024-01-02" and m[1]["to"] == "2024-01-05"
