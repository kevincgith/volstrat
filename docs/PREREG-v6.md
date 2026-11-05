# VolStrat v6: which asset behaves best in which regime (pre-registration)

Written 2026-11-05, before any result. Changes after the commit that adds this file are
appended as dated amendments.

## 1. Question

The regime portfolios (METHODOLOGY §6) were built by hand. §11 measured only the S&P 500 in
each regime, and §13.1 fitted per-regime portfolios on estimated *mean* returns, which failed
walk-forward (Sharpe 0.51 against 0.60 for the hand-built portfolios). Two questions remain:

1. How does each asset in the universe behave in each regime, and which of those properties
   are **stable** enough to build on?
2. Does a regime portfolio built from the stable properties beat the hand-built one out of
   sample?

## 2. Part A: description and stability (hypothesis stated before running)

- **Regimes:** the Growth profile's regime path (score regimes with the panic-rebound
  override), known at the close of t, paired with each asset's return on t + 2 (the first
  return a trade at the next close can earn), as in §11.
- **Assets:** every engine asset with history from 2007 (proxy chains included): SPX, WORLD,
  QQQ, EFA, EEM, VNQ, SHY, IEI, IEF, TLH, TLT, TIP, AGG, GLD, XLU, DBC, UUP, BIL. SSO, UPRO and
  QLD are leveraged versions and are left out; factor ETFs start in 2011.
- **Per asset and regime:** annualised excess return over T-bills, volatility, Sharpe ratio,
  and correlation of daily returns with the S&P 500.
- **Stability:** across all assets, the Spearman rank correlation of each property between
  2007–2016 and 2017–2026, regime by regime; for assets with history from 1993, also
  1993–2006 against 2007–2026.

**Hypothesis:** volatility and correlation with stocks are stable (median rank correlation
across regimes above 0.7), while excess return and Sharpe are not (median below 0.3). If so,
regime portfolios should be chosen by risk and hedging properties, not by past returns.

## 3. Part B: a risk-based regime portfolio (frozen)

Same equity exposure per regime as Growth (Crisis 0, Risk-Off 0, Neutral 80% SPX, Risk-On
75% SPX + 25% SSO, Strong Risk-On 100% SSO). Only the **defensive share** (Crisis 100%,
Risk-Off 100%, Neutral 20%) is rebuilt from the evidence:

- **Candidates:** SHY, IEI, IEF, TLH, TLT, TIP, AGG, GLD, XLU, DBC, UUP, BIL.
- **Each 1 January from 2007**, using only regime-days up to that date (from 1993; at least
  250 days in the regime; Risk-Off estimates used for Neutral's defensive share), pick the
  **two** candidates with the **lowest correlation with the S&P 500 in that regime**, and
  weight them by inverse volatility in that regime. Only candidates with at least 250
  regime-days of history are eligible.
- Everything else as Growth: rebound override, next-close trading, 5 bp per side.

**Comparisons, 2007–2026:** Growth with its hand-built portfolios; and, reported only, a
return-based version that picks the two candidates with the highest Sharpe ratio in the
regime (expected to be worse, per §13.1).

**Criteria:**

| # | Criterion |
|---|---|
| A | Sharpe above Growth's over 2007–2026 and in both 2007–2016 and 2017–2026 |
| B | Worst drawdown no deeper than Growth's |
| C | Sharpe above Growth's in ≥ 80% of paired block-bootstrap resamples (21-day blocks, 1,000 draws) |

**Verdict:** pass if A–C hold; the risk-based selection then becomes an option for the regime
profiles. Otherwise fail, reported as such. Either way, the Part A tables are published.

## Amendment log
- 2026-11-05: run once (METHODOLOGY §19). Part A hypothesis holds: median rank correlation
  across regimes 0.93 / 0.90 for volatility and 0.89 / 0.76 for correlation with stocks,
  against 0.22 / −0.05 for Sharpe (2007–16 vs 2017–26; 1993–2006 vs 2007–26). Part B fails
  A, B and C (Sharpe 0.62 vs 0.66, max drawdown −27.4% vs −23.8%, bootstrap 23%).
  **Verdict: fail.**

