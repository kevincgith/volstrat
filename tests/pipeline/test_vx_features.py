import math

import pandas as pd

from volstrat_pipeline.build.vx import features, interpolate, live_curve


def make_vx():
    d1, d2 = pd.Timestamp("2024-01-16"), pd.Timestamp("2024-01-17")  # d2 = Jan expiry
    rows = []
    for d in (d1, d2):
        for exp, px in (("2024-01-17", 13.0), ("2024-02-14", 14.0), ("2024-03-20", 15.0),
                        ("2024-04-17", 16.0)):  # fmt: skip
            rows.append({"date": d, "expiry": pd.Timestamp(exp), "settle": px})
    return pd.DataFrame(rows)


def test_expiring_contract_excluded_on_expiry_day():
    lc = live_curve(make_vx())
    on_expiry = lc[lc["date"] == "2024-01-17"]
    assert on_expiry["expiry"].min() == pd.Timestamp("2024-02-14")


def test_vx1_vx2_roll():
    f = features(make_vx(), pd.Series({pd.Timestamp("2024-01-16"): 12.0,
                                       pd.Timestamp("2024-01-17"): 12.0}))  # fmt: skip
    assert f.loc["2024-01-16", "VX1"] == 13.0 and f.loc["2024-01-16", "VX2"] == 14.0
    assert f.loc["2024-01-17", "VX1"] == 14.0 and f.loc["2024-01-17", "VX2"] == 15.0
    assert f.loc["2024-01-16", "VX1_DTE"] == 1


def test_constant_maturity_interpolation_and_spot_anchor():
    spot = pd.Series({pd.Timestamp("2024-01-16"): 12.0, pd.Timestamp("2024-01-17"): 12.0})
    f = features(make_vx(), spot)
    # 2024-01-17: live = Feb (28d, 14), Mar (63d, 15), Apr (91d, 16)
    # CM30 between Feb and Mar: 14 + (30-28)/(63-28) * 1
    assert math.isclose(f.loc["2024-01-17", "VX_CM30"], 14 + 2 / 35)
    # CM90 between Mar and Apr
    assert math.isclose(f.loc["2024-01-17", "VX_CM90"], 15 + 27 / 28)


def test_no_extrapolation():
    assert math.isnan(interpolate([10.0, 40.0], [14.0, 15.0], 60))
    assert interpolate([0.0, 10.0], [12.0, 14.0], 5) == 13.0
