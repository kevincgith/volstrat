# VolStrat v13: a recession-gated trend brake (pre-registration)

Written 2026-11-05, before the unemployment data were downloaded and before any result. Changes
after the commit that adds this file are appended as dated amendments.

## 1. Why

Five re-entry families (METHODOLOGY §21–§24) worked after 1990 and failed before. The failures
were in recession bear markets (1929–1932, 1937–1938, 1973–1974; since 1990, 2000–2002 and
2008), which grind down with repeated failed rallies. The recoveries they caught were mostly
sell-offs without a recession (1962, 1987, 1998, 2011, 2015, 2018, 2025), which tend to end in a
V. If the economic cycle can tell the two apart in real time, the trend brake can be kept for
recession sell-offs and lifted otherwise. This is growth-trend timing (Philosophical Economics,
2016): apply a trend filter only while unemployment is rising.

## 2. Data

- **Unemployment rate**, FRED series UNRATE (monthly, from 1948-01), current vintage.
  **Publication lag:** the value for month M is used only from the first trading day after the
  10th of month M + 1 (the release is normally on the first Friday). **Revisions:** current-
  vintage values differ from those first published (seasonal factors are revised every year,
  usually by 0.1–0.2 points); this is a known limitation, not corrected.
- **Market:** Ken French daily US market (Mkt-RF + RF), T-bills as cash.
- **Period:** 1950-01 (once 12 months of unemployment history and the 200-day average exist)
  to latest. Before data checks, nothing but coverage and gaps may be examined.

## 3. Rules (frozen)

**Recession signal R_t:** the latest available unemployment rate is above its average over the
latest 12 available months.

- **V0 (v5):** equity = min(1, 12% / 21-day volatility), halved below the 200-day average.
- **G1 recession-gated brake:** as V0, but the halving applies only while R_t is on.
- **G2 recession-gated breadth re-entry:** as V0, but while R_t is **off**, the brake is lifted
  during the 63 days after a B2 Deemer-style breadth thrust (§24 definition, 49-industry
  breadth). Reported alongside G1; the bootstrap bar is 90% because two variants are tested.

All variants: trade at the next close when the equity weight is more than 10 points off target;
5 bp per side; no leverage.

## 4. Criteria (against V0 on the same days)

| # | Criterion |
|---|---|
| C1 | Sharpe above V0 in both 1950–1989 and 1990–latest |
| C2 | Sharpe above V0 in ≥ 90% of paired block-bootstrap resamples, 1950–latest (21-day blocks, 1,000 draws) |
| C3 | Worst drawdown no more than 3 points deeper than V0's in either era |
| C4 | Median 3-month return after the major lows since 1950 (1962-06-26, 1970-05-26, 1974-10-03, 1982-08-12, 1987-12-04, 1990-10-11, 2002-10-09, 2009-03-09, 2011-10-03, 2020-03-23, 2022-10-12) above V0's |

Also reported: how often R_t was on, whether it was on during each major bear market, and the
signal's lead or lag against NBER recession dates (descriptive only; NBER dates are known only
afterwards and are not used by the rule).

**Verdict:** a variant passes if C1–C4 hold; if both pass, the higher 1950–latest Sharpe is
chosen. A pass becomes a risk-budget option with the unemployment series added to the pipeline
(FRED UNRATE, with the publication lag above) and its own live record. Otherwise fail.

## Amendment log
- 2026-11-05, before the run: FRED's download endpoint failed (connection reset, then no
  response), so the same series was taken from its source, the BLS (LNS14000000, seasonally
  adjusted unemployment rate, identical to FRED UNRATE): 1948-01 to 2025-01 from the DBnomics
  mirror, 2024-01 to 2026-09 from the BLS public API, BLS values preferred where both exist. The
  13 overlapping months agree except 2024-05 (4.0 vs 3.9, the annual seasonal revision). 2025-10
  is missing (not collected during the federal government shutdown); the rule uses the latest
  12 available months, so it is unaffected otherwise.
- 2026-11-05: run once (METHODOLOGY §25). G1 fails C1 (1950–1989 Sharpe tied at 0.72), C2 (77%) and
  C3 (1950–1989 drawdown −25.5% vs −21.9%); passes C4. G2 fails C1 and C2. **Verdict: fail.**

