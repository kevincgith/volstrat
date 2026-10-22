import pandas as pd

from volstrat_pipeline.sources import cboe_indices, cboe_putcall, fred, treasury, yahoo


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


def test_yahoo_drops_intraday_bar():
    idx = pd.to_datetime(["2024-01-02", "2024-01-03"])
    df = pd.DataFrame({"close": [1.0, 2.0]}, index=idx)
    during = pd.Timestamp("2024-01-03 14:00", tz="America/New_York")
    after = pd.Timestamp("2024-01-03 17:00", tz="America/New_York")
    assert len(yahoo.drop_incomplete_today(df, during)) == 1
    assert len(yahoo.drop_incomplete_today(df, after)) == 2
