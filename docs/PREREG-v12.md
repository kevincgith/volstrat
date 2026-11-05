# VolStrat v12: breadth-thrust re-entry from a century of industry data (pre-registration)

Written 2026-11-05, before downloading the industry data and before any result. Changes after
the commit that adds this file are appended as dated amendments.

## 1. Why

Every re-entry signal tested so far (v8, v10, v11) failed, and their usefulness flipped between
1928–1989 and 1990–2026. The one family never tested is **breadth thrusts**, the practitioner
signals that fire closest to real bottoms (Zweig; Deemer; research notes in
`research_notes/Re-entry after market sell-offs/practitioner_signals.md`). They were untested
because no free daily NYSE advance/decline history exists.

**New data:** Ken French's daily returns of 49 US industry portfolios (value-weighted), from
1926. The share of industries that rose each day is a breadth measure covering every bear market
since 1929. It is coarser than stock counts (49 groups, not ~3,000 stocks), so canonical
thresholds may behave differently; they are used as published rather than refitted.

**Honest limit.** Both periods have been used to test other signals, though never breadth. The
bar is therefore consistency: a signal must work in **both** eras.

## 2. Breadth and signals (frozen)

Each day, using only industries with a return that day (missing values excluded):
- **Advance ratio** A_t = advancing industries / (advancing + declining industries).

| # | Signal | Fires when | Active |
|---|---|---|---|
| B1 | Zweig-style thrust | the 10-day EMA of A_t rises from below 0.40 to above 0.615 within 10 trading days | 63 trading days after firing |
| B2 | Deemer-style breakaway | over the last 10 days, total advancing ÷ total declining industries > 1.97 | 63 trading days after firing |
| B3 | Breadth recovery | the share of industries above their own 50-day average crosses above 50% while the market is below its 200-day average | 63 trading days after firing |

## 3. Tests

**Market and stress days:** Ken French daily US market (Mkt-RF + RF), 1928–2026. Stress day =
market below its 200-day average and v5's equity weight below 50% (as in §23).

**Step 1, signal quality, in each era separately (1928–1989 and 1990–2026):** on stress days
when the signal is active, mean forward 63-day market return and false-alarm share (63-day loss
worse than −10%), against all stress days. Also: the number of independent firings and their
dates.

A signal **qualifies** only if, **in both eras**, its mean forward return is higher than on all
stress days and its false-alarm share is no higher.

**Step 2, backtest of each qualifying signal:** v12 = v5 on the French market with T-bills as
the rest (v5's 12% target, 21-day volatility, 200-day brake, 10-point band, 5 bp), but **while
the signal is active the trend brake is not applied**. Against v5 on the same data:

| # | Criterion |
|---|---|
| C1 | Sharpe above v5 in both 1928–1989 and 1990–2026 |
| C2 | Sharpe above v5 in ≥ 80% of paired block-bootstrap resamples, 1928–2026 (21-day blocks, 1,000 draws); 90% if more than one signal qualifies |
| C3 | Worst drawdown no more than 3 points deeper than v5's in either era |
| C4 | Median 3-month return after the major lows (1932-06-01, 1938-03-31, 1942-04-28, 1962-06-26, 1970-05-26, 1974-10-03, 1982-08-12, 1987-12-04, 1990-10-11, 2002-10-09, 2009-03-09, 2011-10-03, 2020-03-23, 2022-10-12) above v5's |

**Verdict:** pass if a signal qualifies and C1–C4 hold. A pass becomes a re-entry option for the
risk-budget mode, with a breadth series added to the pipeline from the French industry file, and
its own live record. Otherwise fail.

## Amendment log
- 2026-11-05: data checks passed (40–49 industries with data every day; dates match the market
  file; 0.9% of returns exactly zero). Step 1 run once: no signal qualifies (B1 and B2 beat all
  stress days in 1990–2026 but not in 1928–1989; B3 fails in both). **Verdict: fail**
  (METHODOLOGY §24). A step-2 backtest of B1 and B2 is reported there, labelled as not part of
  the test.

