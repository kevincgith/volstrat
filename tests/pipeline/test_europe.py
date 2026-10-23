import numpy as np
import pandas as pd

from volstrat_pipeline.europe import cash_returns, monthly_bond_returns, zero_bond_returns


def test_zero_bond_flat_yield_earns_carry_only():
    cal = pd.bdate_range("2020-01-01", periods=10)
    r = zero_bond_returns(pd.Series(3.0, index=cal), cal, years=7)
    assert np.isnan(r.iloc[0])
    days = pd.Series(cal, index=cal).diff().dt.days
    assert np.allclose(r.iloc[1:], 1.03 ** (days.iloc[1:] / 365) - 1)


def test_zero_bond_reprices_on_yield_change():
    cal = pd.bdate_range("2020-01-01", periods=2)
    r = zero_bond_returns(pd.Series([3.0, 4.0], index=cal), cal, years=7)
    expected = (1.03**7 / 1.04**7) * 1.03 ** (1 / 365) - 1
    assert abs(r.iloc[1] - expected) < 1e-12 and r.iloc[1] < -0.06


def test_monthly_returns_compound_to_the_month_total():
    cal = pd.bdate_range("2001-01-01", "2001-03-31")
    y = pd.Series([5.0, 5.5, 5.0], index=pd.to_datetime(["2001-01-01", "2001-02-01", "2001-03-01"]))
    r = monthly_bond_returns(y, cal, years=7)
    feb = r[(r.index.month == 2)]
    total = (1 + feb).prod() - 1
    assert abs(total - ((1.05**7 / 1.055**7) * 1.05 ** (1 / 12) - 1)) < 1e-12
    assert feb.nunique() == 1 and r[r.index.month == 1].isna().all()


def test_cash_accrues_act_360_on_previous_rate():
    cal = pd.DatetimeIndex(["2020-01-03", "2020-01-06"])  # Fri -> Mon
    r = cash_returns(pd.Series([3.6, 0.0], index=cal), cal)
    assert abs(r.iloc[1] - 0.036 * 3 / 360) < 1e-15
