import pandas as pd
import pytest

from volstrat_pipeline.build.align import as_of
from volstrat_pipeline.sources import unrate


def monthly(values, start="2020-01-01"):
    return pd.Series(
        values, index=pd.date_range(start, periods=len(values), freq="MS"), dtype=float
    )


def test_gap_is_latest_minus_trailing_12_observation_mean():
    s = monthly([4.0] * 11 + [5.2, 6.4])
    g = unrate.gap(s)
    assert g.index[0] == pd.Timestamp("2020-12-01")  # first month with 12 observations
    assert g.iloc[0] == pytest.approx(5.2 - (4.0 * 11 + 5.2) / 12)
    assert g.iloc[1] == pytest.approx(6.4 - (4.0 * 10 + 5.2 + 6.4) / 12)


def test_gap_skips_a_month_that_was_never_published():
    s = monthly([4.0] * 13).drop(pd.Timestamp("2020-10-01"))
    g = unrate.gap(s)
    assert len(g) == 1 and g.index[0] == pd.Timestamp("2021-01-01")


def test_release_lag_month_value_known_only_from_the_11th_of_next_month():
    s = monthly([4.0, 9.9], start="2026-01-01")  # January and February values
    cal = pd.bdate_range("2026-03-09", "2026-03-16")
    v = as_of(s, cal, lag_days=41, max_stale_days=70)
    # February (dated 2026-02-01) becomes known on 2026-03-14 or later: never on the 9th-13th
    assert (v[v.index < "2026-03-14"] == 4.0).all()
    assert v["2026-03-16"] == 9.9


def test_parse_bls_drops_annual_average_and_blanks():
    payload = {
        "status": "REQUEST_SUCCEEDED",
        "Results": {
            "series": [
                {
                    "data": [
                        {"year": "2026", "period": "M09", "value": "4.2"},
                        {"year": "2026", "period": "M13", "value": "4.1"},
                        {"year": "2025", "period": "M10", "value": "-"},
                        {"year": "2025", "period": "M11", "value": "4.0"},
                    ]
                }
            ]
        },
    }
    s = unrate.parse_bls(payload)
    assert list(s.index) == [pd.Timestamp("2025-11-01"), pd.Timestamp("2026-09-01")]
    assert s.iloc[-1] == 4.2
