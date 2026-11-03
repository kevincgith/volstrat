from volstrat_pipeline.changes import classify, compare_csv

OLD = "date,close,adj_close\n2026-10-30,3898.9,3898.9\n2026-11-02,3965,3965\n"


def test_small_revision_of_last_bar_is_not_news():
    new = OLD.replace("3965,3965", "3936.2,3936.2")  # GC=F between two hourly runs
    assert compare_csv(OLD, new) is None


def test_large_revision_is_news():
    new = OLD.replace("3965,3965", "3900,3900")
    assert "close" in compare_csv(OLD, new)


def test_new_rows_are_news():
    assert compare_csv(OLD, OLD + "2026-11-03,3970,3970\n") == "+1 rows"


def test_blank_filled_is_news():
    old = "date,NFCI,DFF\n2026-10-26,,3.88\n"
    assert compare_csv(old, old.replace(",,", ",-0.5,")) is not None


def test_many_revised_rows_are_news():
    old = "date,x\n" + "".join(f"2026-01-{d:02d},100\n" for d in range(1, 31))
    assert "rows revised" in compare_csv(old, old.replace(",100", ",100.1"))


def test_classify_revision_only_skips():
    site = ('{"a":1}', '{"a":2}')
    commit, lines = classify(
        {
            "data/raw/yahoo/GC_F.csv": (OLD, OLD.replace("3965", "3963")),
            "data/site/signals.json": site,
            "data/site/meta.json": site,
        }
    )
    assert not commit and lines == ["revised  data/raw/yahoo/GC_F.csv (within 1%)"]


def test_classify_regime_change_always_commits():
    commit, _ = classify({"data/raw/yahoo/GC_F.csv": (OLD, OLD.replace("3965", "3963"))}, True)
    assert commit


def test_classify_site_rebuilt_without_raw_change_commits():
    commit, lines = classify({"data/site/signals.json": ("{}", '{"a":1}')})
    assert commit and lines == ["news     data/site/signals.json: rebuilt"]


def test_classify_bookkeeping_only_skips():
    assert classify({"data/raw/_fetch_status.json": ("{}", '{"a":1}')}) == (False, [])
