import numpy as np
import pandas as pd

from volstrat_pipeline.build.absorption import absorption_ratio


def _prices(r: np.ndarray) -> pd.DataFrame:
    idx = pd.bdate_range("2020-01-01", periods=len(r) + 1)
    return pd.DataFrame(
        100 * np.exp(np.vstack([np.zeros(r.shape[1]), r]).cumsum(axis=0)), index=idx
    )


def test_one_factor_market_is_fully_absorbed():
    rng = np.random.default_rng(0)
    f = rng.normal(0, 0.01, (300, 1))
    ar = absorption_ratio(_prices(f @ np.ones((1, 9))), n_pc=2, window=100, halflife=50)
    assert ar.iloc[:99].isna().all() and ar.iloc[99:].notna().all()
    assert np.allclose(ar.dropna(), 1.0)


def test_independent_assets_spread_variance():
    rng = np.random.default_rng(1)
    ar = absorption_ratio(_prices(rng.normal(0, 0.01, (2000, 9))), n_pc=2, window=500, halflife=1e9)
    # equal-variance independent assets: about 2/9 (a little more: sample eigenvalues spread)
    assert 0.22 < ar.dropna().mean() < 0.35


def test_causal():
    rng = np.random.default_rng(2)
    p = _prices(rng.normal(0, 0.01, (400, 9)))
    full = absorption_ratio(p, window=100, halflife=50)
    part = absorption_ratio(p.iloc[:300], window=100, halflife=50)
    pd.testing.assert_series_equal(full.iloc[: len(part)], part)
