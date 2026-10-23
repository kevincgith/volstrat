import pandas as pd

from volstrat_pipeline.sources.cfe_vx import normalise, parse_contract_csv

HEADER = "Trade Date,Futures,Open,High,Low,Close,Settle,Change,Total Volume,EFP,Open Interest"


def test_parse_skips_disclaimer_and_handles_extra_fields():
    text = "\n".join(
        [
            "CFE data is compiled for the convenience of site visitors",
            HEADER,
            "01/02/2013,F (Jan 13),16.8,16.8,15.5,15.6,15.65,0,100,0,1000",
            "01/03/2013,F (Jan 13),15.6,15.9,15.0,15.2,15.25,0,100,0,1000,",  # trailing empty
            "01/04/2013,F (Jan 13),15.6,15.9,15.0,15.2,15.25,0,100,0,1000,junk",  # malformed
        ]
    )
    df, dropped = parse_contract_csv(text)
    assert len(df) == 2 and dropped == 1
    assert df["settle"].tolist() == [15.65, 15.25]


def test_normalise_rescales_pre_2007_and_drops_zero_settles():
    df = pd.DataFrame(
        {
            "date": pd.to_datetime(["2006-05-01", "2006-05-02", "2007-03-26", "2007-03-27"]),
            "open": [150.0, 0.0, 15.0, 15.0],
            "high": [150.0, 0.0, 15.0, 15.0],
            "low": [150.0, 0.0, 15.0, 15.0],
            "close": [150.0, 0.0, 15.0, 15.0],
            "settle": [152.0, 0.0, 15.2, 15.3],
            "volume": [1, 0, 1, 1],
            "open_interest": [1, 0, 1, 1],
        }
    )
    out = normalise(df, pd.Timestamp("2007-04-18"), "archive")
    assert out["settle"].tolist() == [15.2, 15.2, 15.3]
    assert (out["expiry"] == pd.Timestamp("2007-04-18")).all()


def test_parse_settlement_file_keeps_live_monthlies_only():
    from volstrat_pipeline.sources.cfe_vx import parse_settlement_file

    text = "\n".join(
        [
            "Product,Symbol,Expiration Date,Price",
            "VX,VX/V6,2026-10-21,16.82",  # expiring today: not live
            "VX,VX43/V6,2026-10-28,18.2382",  # weekly: ignored
            "VX,VX/X6,2026-11-18,18.2382",
            "VX,VX/Z6,2026-12-16,18.5457",
            "VXM,VXM/X6,2026-11-18,18.24",  # mini: ignored
        ]
    )
    df = parse_settlement_file(text, pd.Timestamp("2026-10-21"))
    assert df["expiry"].dt.strftime("%Y-%m-%d").tolist() == ["2026-11-18", "2026-12-16"]
    assert df["settle"].tolist() == [18.2382, 18.5457]
    assert (df["src"] == "settle_file").all()
