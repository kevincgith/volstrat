import pandas as pd

from volstrat_pipeline.sources import cboe_indices, cboe_putcall, fred, treasury


def test_cboe_index_parse_drops_zero_placeholders():
    text = "DATE,OPEN,HIGH,LOW,CLOSE\n01/02/1990,17.24,17.24,17.24,17.24\n01/03/1990,0,0,0,0\n"
    s = cboe_indices.parse(text, "CLOSE")
    assert len(s) == 1 and s.iloc[0] == 17.24


def test_putcall_static_parse_and_stitch_priority():
    text = (
        "Cboe disclaimer line\n, PRODUCT: EQUITY,,EXCHANGE: Cboe,\n"
        "DATE,CALL,PUT,TOTAL,P/C Ratio\n11/1/2006,976510,623929,1600439,0.64\n"
        "11/2/2006, 1, 2, 3, 0.70\n"
    )
    df = cboe_putcall.parse_static(text)
    assert df["P/C RATIO"].tolist() == [0.64, 0.70]
    alt = cboe_putcall.parse_static(
        "x\nIndex P/C Ratios,,,,\nTrade_date,Call,Put,Total,P/C Ratio\n10/17/2003,1,2,3,2\n"
    )
    assert alt["P/C RATIO"].tolist() == [2.0]
    older = pd.DataFrame({"equity": [0.5, 0.6]}, index=pd.to_datetime(["2006-11-01", "2006-10-31"]))
    newer = pd.DataFrame({"equity": [0.64]}, index=pd.to_datetime(["2006-11-01"]))
    out = cboe_putcall.stitch([("pc", newer), ("pcarchive", older)])
    assert out.loc["2006-11-01", "equity"] == 0.64 and out.loc["2006-11-01", "src"] == "pc"
    assert out.loc["2006-10-31", "src"] == "pcarchive"


def test_treasury_parse_handles_missing_tenors():
    text = 'Date,"3 Mo","2 Yr","10 Yr"\n12/31/1990,6.63,7.15,8.08\n'
    df = treasury.parse(text)
    assert df.loc["1990-12-31", "y10y"] == 8.08 and pd.isna(df.loc["1990-12-31", "y1m"])


def test_fred_parse_drops_missing_markers():
    s = fred.parse_graph_csv("observation_date,X\n2024-01-01,.\n2024-01-02,3.5\n")
    assert len(s) == 1 and s.iloc[0] == 3.5


def test_eod_cutoff_excludes_live_and_provisional_days():
    from volstrat_pipeline.sources.base import cut, eod_cutoff

    ny = "America/New_York"
    # Wednesday 21 Oct 2026, market open: the 21st is live -> cutoff is the 20th
    assert eod_cutoff(pd.Timestamp("2026-10-21 11:00", tz=ny)) == pd.Timestamp("2026-10-20")
    # 16:30: closed but still provisional
    assert eod_cutoff(pd.Timestamp("2026-10-21 16:30", tz=ny)) == pd.Timestamp("2026-10-20")
    # 18:05: end-of-day confirmed
    assert eod_cutoff(pd.Timestamp("2026-10-21 18:05", tz=ny)) == pd.Timestamp("2026-10-21")
    # Monday morning -> previous Friday; Saturday -> Friday
    assert eod_cutoff(pd.Timestamp("2026-10-26 09:00", tz=ny)) == pd.Timestamp("2026-10-23")
    assert eod_cutoff(pd.Timestamp("2026-10-24 12:00", tz=ny)) == pd.Timestamp("2026-10-23")
    # UTC input is converted (23:30 UTC = 19:30 EDT)
    assert eod_cutoff(pd.Timestamp("2026-10-21 23:30", tz="UTC")) == pd.Timestamp("2026-10-21")
    s = pd.Series([1.0, 2.0], index=pd.to_datetime(["2026-10-20", "2026-10-21"]))
    assert len(cut(s, pd.Timestamp("2026-10-20"))) == 1


def test_cboe_blank_never_overwrites_stored_value(tmp_path, monkeypatch):
    from volstrat_pipeline.sources import cboe_indices
    from volstrat_pipeline.storage import read_cache, safe_write

    idx = pd.bdate_range("2026-10-19", periods=4)
    stored = pd.DataFrame({k: [20.0, 21.0, 22.0, 19.03] for k in cboe_indices.SYMBOLS}, index=idx)
    safe_write(stored, tmp_path / cboe_indices.CACHE)
    blank_today = stored.copy()
    blank_today.loc[idx[-1], "VIX"] = float("nan")  # CDN served a stale version
    monkeypatch.setattr(
        cboe_indices, "parse", lambda text, col: blank_today["VIX" if col == "CLOSE" else col]
    )
    monkeypatch.setattr(cboe_indices, "get", lambda url: type("R", (), {"text": ""})())
    monkeypatch.setattr(cboe_indices, "SYMBOLS", {"VIX": ("CLOSE", (5, 150))})
    st = cboe_indices.update(tmp_path, cutoff=idx[-1])
    assert read_cache(tmp_path / cboe_indices.CACHE).loc[idx[-1], "VIX"] == 19.03
    assert any("blank" in w for w in st.warnings)
