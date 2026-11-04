# VolStrat v4: pre-registration

Written 2026-11-04, **before** any v4 code or result. The git commit that adds this file is
its timestamp. Changes after that are appended as dated amendments, never edited in place.

## 1. Why

The weaknesses found so far (METHODOLOGY §15.4, §15.8, §16, and the VTS tests in
`reports/VTS strategy structure and signals.md`):

1. **One signal family.** Seven of the nine default components measure the volatility
   complex. The score is a detector of volatility shocks: it misses slow, high-volatility bear
   markets (2000–2002) and under-invests in high-volatility booms (1996–1999).
2. **Relative calibration.** Ranks against the last 3 years make a VIX of 22 look calm after
   a volatile stretch (2002).
3. **Fixed defensive mix.** Risk-Off holds IEF, gold and utilities whatever they are doing:
   utilities fell 29% in 2002 and bonds fell with stocks in 2022.
4. **Late re-entry.** Growth captured a median of 29% of the S&P 500's 3-month rebound after
   ten lows since 2007.

v4 makes three changes, each aimed at one weakness, with settings chosen on principle and not
fitted. Everything else is Growth, unchanged.

## 2. The v4 design (frozen)

### 2.1 Trend pillar at half the weight (weaknesses 1 and 4)
Three new components, all S&P 500 price returns, oriented so that a higher return = risk-on:
- `mom_1m`: 21-trading-day return;
- `mom_3m`: 63-trading-day return;
- `mom_12m`: 252-trading-day return.

With the existing 200-day trend component, the trend family gets **half the total weight**:
the eight non-trend default components keep their weights (sum 5.25), and each of the four
trend components gets 5.25 / 4 = **1.3125**. The 1-month return is the fast leg that should
turn up after a low before the volatility measures recover (Goulding, Harvey & Mazzoleni
2023, fast and slow momentum).

### 2.2 Whole-history ranks (weakness 2)
Every component is ranked against **its whole history to date** (expanding window, at least
252 observations) instead of the last 756 days, as in v3.

### 2.3 Defensive assets need their own trend (weakness 3)
In every regime portfolio, each bond, gold or utilities holding (IEI, IEF, TLH, TLT, TIP, AGG,
GLD, XLU) is kept only if its trailing **252-day total return is above that of T-bills (BIL)**
at the close of the decision day. Otherwise its weight moves to BIL. Equity holdings and
T-bills are never changed. This is absolute momentum (Antonacci) applied to the defensive side.

Unchanged from Growth: regime cut-offs 20/40/60/80, 2.5-point hysteresis, 5-day EMA, the
panic-rebound override, portfolios, next-close execution, 5 bp costs.

## 3. Data and periods

| Period | Role | Portfolios |
|---|---|---|
| 2007–latest | design era | Growth portfolios as they are |
| 1993–2006 | independent era (METHODOLOGY §15.8) | Growth with Risk-Off = 75% IEF / 25% XLU (gold history starts 2000-08) |
| 1993–latest | bootstrap | as for 1993–2006 |

Europe was used once for v3 and is no longer a clean holdout; it is not used.

## 4. Criteria

Reference **Growth** = the current default. **60/40** = the engine's 60% S&P 500 / 40% AGG
benchmark, rebalanced monthly.

| # | Criterion |
|---|---|
| A | Sharpe above 60/40 in **both** 1993–2006 and 2007–latest |
| B | Sharpe above Growth in **both** periods |
| C | Worst drawdown no deeper than Growth's in either period |
| D | Sharpe above Growth in **≥ 80%** of paired block-bootstrap resamples (21-day blocks, 1,000 draws), 1993–latest |
| E | A and B still hold for the **median** result over regime cut-offs shifted by −5, 0, +5 points |

**Verdicts:**
- **Pass:** A–E hold. v4 becomes a preset and a live record v3 can start. The default stays
  Growth until the live record has enough history to judge.
- **Partial:** B, C and D hold but A fails. v4 is a better Growth but still not a better 60/40;
  it becomes a preset, reported as such.
- **Fail:** anything else. The components and the filter stay in the engine as options, off by
  default, and the result is reported.

Also reported, though they don't decide the verdict: each change on its own (ablations), CAGR,
average equity exposure, cost drag, the 2008–09 drawdown and the median 3-month rebound
capture.

## 5. Commitments
- One run of the frozen design. No revision round: if it fails, that is the answer.
- The new options are off in `BASE_PARAMS`, so frozen track records (`data/track/`) are
  unchanged.

## Amendment log
- 2026-11-04: run once with the frozen design (METHODOLOGY §17). A, B, D and E fail; C
  passes. **Verdict: fail.** Defaults unchanged; the options stay off by default.
