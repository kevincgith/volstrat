import numpy as np
import pandas as pd

from volstrat_pipeline.checks import crosscheck as cc

IDX = pd.bdate_range("2024-01-01", periods=80)


def test_calendar_lag_flagged():
    assert cc.calendar_vs_cboe(IDX[-1], IDX[-1]).ok
    bad = cc.calendar_vs_cboe(IDX[-2], IDX[-1])
    assert not bad.ok and "behind" in bad.detail


def test_vol_index_agreement():
    a = pd.Series(np.linspace(15, 20, 80), index=IDX)
    cboe = pd.DataFrame({"VIX3M": a, "VVIX": a * 5})
    good = cc.vol_index_agreement(cboe, {"^VIX3M": a * 1.001, "^VVIX": a * 5})
    assert all(c.ok for c in good)
    bad = cc.vol_index_agreement(cboe, {"^VIX3M": a * 1.05, "^VVIX": a * 5})
    assert not bad[0].ok


def test_spy_vs_index_and_jumps():
    rng = np.random.default_rng(0)
    px = pd.Series(100 * np.cumprod(1 + rng.normal(0, 0.01, 80)), index=IDX)
    assert cc.spy_vs_index(px, px * 3).ok
    assert not cc.spy_vs_index(
        px, pd.Series(100 * np.cumprod(1 + rng.normal(0, 0.01, 80)), index=IDX)
    ).ok
    jumped = px.copy()
    jumped.iloc[-1] *= 1.5
    assert not cc.jumps({"SPX": jumped})[0].ok
    assert cc.jumps({"SPX": px})[0].ok


def test_futures_vs_spot_and_staleness():
    sig = pd.DataFrame(
        {"VX1": [18.0] * 80, "VIX": [17.0] * 80, "PC_EQUITY": [0.6] * 75 + [np.nan] * 5}, index=IDX
    )
    assert cc.futures_vs_spot(sig).ok
    st = {c.name: c for c in cc.staleness(sig, ["VIX", "PC_EQUITY"], max_bdays=3)}
    assert st["VIX fresh"].ok and not st["PC_EQUITY fresh"].ok


def test_completeness_gate(tmp_path):
    from volstrat_pipeline.build import export
    from volstrat_pipeline.sources import yahoo
    from volstrat_pipeline.storage import safe_write

    idx = pd.bdate_range("2026-10-19", periods=4)  # Mon..Thu
    full = pd.DataFrame({"close": [1.0, 2, 3, 4], "adj_close": [1.0, 2, 3, 4]}, index=idx)
    for sym in export.REQUIRED_YAHOO:
        safe_write(full if sym != "SPY" else full.iloc[:3], tmp_path / yahoo.cache_name(sym))
    cb = pd.DataFrame({k: [20.0, 21, 22, 23] for k in export.REQUIRED_CBOE}, index=idx)
    cb.loc[idx[-1], "VIX"] = np.nan  # Cboe row exists but VIX not yet filled
    safe_write(cb, tmp_path / "cboe_indices.csv")
    complete, pending = export.completeness(tmp_path, idx[-1])
    assert complete == idx[2]
    assert set(pending) == {"Yahoo SPY", "Cboe VIX"}


def test_incomplete_alert_deadline():
    from volstrat_pipeline.build.export import incomplete_alert

    ny = "America/New_York"
    pend = {"CFE VIX futures": "2026-10-21"}
    # Thu 22 Oct data still missing: no alert overnight or Friday morning ...
    assert (
        incomplete_alert("2026-10-22", "2026-10-21", pend, pd.Timestamp("2026-10-23 09:00", tz=ny))
        is None
    )
    # ... alert from Friday 12:00 New York
    msg = incomplete_alert(
        "2026-10-22", "2026-10-21", pend, pd.Timestamp("2026-10-23 12:05", tz=ny)
    )
    assert msg and "CFE VIX futures" in msg
    # complete: never an alert
    assert (
        incomplete_alert("2026-10-22", "2026-10-22", {}, pd.Timestamp("2026-10-23 15:00", tz=ny))
        is None
    )
    # Friday data: deadline is Monday noon
    assert (
        incomplete_alert("2026-10-23", "2026-10-22", pend, pd.Timestamp("2026-10-26 11:00", tz=ny))
        is None
    )
