# VolStrat v5: a simple risk-budget rule (pre-registration)

Written 2026-11-04, **before** any v5 code, before downloading the pre-1990 data, and before
any result. The git commit that adds this file is its timestamp. Changes after that are
appended as dated amendments, never edited in place.

## 1. Why this design

VolStrat's own diagnostics (METHODOLOGY §11) show that the score sorts **risk**, not return:
after Crisis days the S&P 500 had 37.2% annualised volatility against 12.4% after Risk-On
days, while the Sharpe ratio was about the same in every regime (0.66–0.70). When the reward
per unit of risk is constant, the mean-variance optimal exposure is proportional to
1 / forecast volatility. So volatility should set **how much** risky asset to hold, smoothly,
not decide in or out. One gap remains: slow, high-volatility bear markets (2000–2002), where
volatility looks normal. A trend brake covers it, halving rather than exiting, because v4
showed that a full trend exit misses V-shaped rebounds.

Earlier designs were tested 30+ times on US 1993–2026, so that period can no longer prove
anything. The decisive test here uses US data from **1927 to 1989**, which no part of this
project has used.

## 2. The rule (frozen)

Each day t, using only data up to the close of t:

1. **Forecast volatility** σ̂ = annualised standard deviation of the last 21 daily equity
   returns (√252 scaling).
2. **Volatility budget** v = min(1, 0.12 / σ̂).
3. **Trend brake**: if the equity total-return index is below its 200-day simple average,
   w = v / 2; otherwise w = v.
4. **Holdings**: equity weight w; the rest in T-bills. In the 1993–2026 check only, the rest is
   held in 7–10y Treasuries (IEF) while the trailing 252-day correlation of daily S&P 500 and
   IEF returns is below 0, and in T-bills otherwise.
5. **Trading**: trade at the close of t + 1 to the day-t target, only when the target equity
   weight differs from the current (drifted) equity weight by more than 10 percentage points.
   Costs: 5 bp per side on the amount traded.

No leverage, no smoothing, no regimes, no other inputs.

## 3. Data

| Period | Role | Equity | Cash | Bonds |
|---|---|---|---|---|
| 1927–1958 and 1959–1989 | **decisive, never used** | Ken French daily market factor (Mkt-RF + RF, value-weighted US stocks) | French daily RF | not used |
| 1993–2026 | secondary check, already seen | engine S&P 500 total return | engine T-bills | engine IEF chain |

Before the run, only data checks are allowed on the French file: coverage, gaps, spikes, and
agreement of its 1993–2026 market return with the engine's S&P 500 (expected correlation of
daily returns above 0.95).

## 4. Benchmarks and criteria

**Primary benchmark:** a static mix of equity and T-bills holding the rule's own **average
equity weight** over the same period, rebalanced monthly, same costs. This isolates timing
from the amount of risk.

| # | Criterion | Data |
|---|---|---|
| A | Sharpe above the static same-exposure mix in **both** 1927–1958 and 1959–1989 | French |
| B | Worst drawdown shallower than that mix in **both** halves | French |
| C | Sharpe above that mix in **≥ 80%** of paired block-bootstrap resamples (21-day blocks, 1,000 draws), 1927–1989 | French |
| D | A holds for the **median** over target volatility {10%, 12%, 15%} × trend window {150, 200, 250} days (9 runs) | French |
| E | 1993–2026: Sharpe at least that of 60/40 (S&P 500 / AGG, monthly) and worst drawdown no deeper | engine |

**Verdicts:**
- **Pass:** A–E hold. v5 becomes a preset ("Risk budget") and a new live record can start.
- **Passes history, not today's check:** A–D hold, E fails. Reported; becomes an optional
  preset, not the default.
- **Fail:** A or C fails. Reported as such; no revision round on the same data.

Also reported, not deciding: each piece alone (volatility budget only, trend brake only),
CAGR, average equity weight, turnover, cost drag, the 1929–1932 and 1973–1974 drawdowns, and
the number of trials in this project so far.

## 5. Disclosure

The idea was chosen with knowledge of VolStrat's results (§11, v4) and of well-known
literature on volatility targeting and trend following, much of which used US data including
1927–1989 (e.g. Moreira & Muir 2017; Hurst, Ooi & Pedersen 2017). So 1927–1989 is unseen
by this project, not by the field. A pass is evidence, not proof.

## Amendment log
- 2026-11-04: data checks on the French file (§3) passed: coverage 1926-07-01 to
  2026-09-30; two gaps, both real closures (1933-03-03 to 03-15, 2001-09-10 to 09-17); all
  daily moves above 10% are known events; daily correlation with the engine S&P 500 from
  1993 is 0.979. The first usable decision is 1927-03-05 (200-day warm-up), so the first half
  starts there.
- 2026-11-04: run once with the frozen rule (METHODOLOGY §18). A, B, C, D and E pass.
  **Verdict: pass.**

