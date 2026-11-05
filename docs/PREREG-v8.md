# VolStrat v8: a risk budget that uses the volatility complex (pre-registration)

Written 2026-11-05, before any v8 code or result. Changes after the commit that adds this file
are appended as dated amendments.

## 1. Why

v5 (METHODOLOGY §18) sizes equity with **realised** volatility: the S&P 500's last 21 daily
returns. That is backward-looking. After a crash it stays high for weeks, so v5 re-enters late
(+6.6% in the three months after the 2020-03-23 low, against +39.9% for the S&P 500). The US
volatility complex is forward-looking and the most complete of any market: VIX from 1990,
VIX3M from 2006. Implied volatility falls quickly once a panic passes, and an inverted
VIX/VIX3M curve that has normalised marks capitulation; that capitulation re-entry is the one
timing rule that has worked in this project (§15.2, §15.5).

**Honest limit.** VIX exists from 1990 and every year since has been used by earlier tests
here (VXO, back to 1986, is no longer downloadable from Cboe). A pass is therefore weaker
evidence than v5's pass on 1927–1989, and the live record will decide.

## 2. Variants (frozen)

Everything not listed is v5: trend brake (halve below the 200-day average of the S&P 500
total-return index), rest in IEF while the trailing 252-day stock–bond correlation is negative
and otherwise T-bills, trade at the next close when the equity weight is more than 10 points off
target, 5 bp per side, no leverage. Target volatility 12%.

- **Bias correction.** VIX overstates future realised volatility on average (the variance risk
  premium). Implied forecasts are scaled by k_t = median(RV21) / median(VIX), both medians
  over all history up to day t (expanding, at least 252 days). No new parameter.
- **W1 implied sizing:** σ̂ = k_t × VIX_t / 100.
- **W2 blended sizing:** σ̂ = (RV21 + k_t × VIX_t / 100) / 2, the standard combination of
  realised and implied forecasts.
- **W3 = W1 plus capitulation re-entry:** the trend brake is lifted for 20 trading days when
  VIX/VIX3M has been above 1.10 within the last 20 days and is now below 1.00 (the rule fixed
  on 2026-10-23, §15.2; inactive before VIX3M exists in 2006-07). A fresh reading above 1.10
  cancels the lift.

## 3. Data and periods

Engine data (S&P 500 total return, IEF chain, BIL, cash), VIX and VIX3M from `signals.json`.
Evaluation from 1991-01-02 (warm-up for the 200-day average and the 252-day medians) to the
latest date, split at 2007-01-01.

## 4. Criteria (against v5 run on the same days)

| # | Criterion |
|---|---|
| C1 | Sharpe above v5 in **both** 1991–2006 and 2007–latest |
| C2 | Sharpe above v5 in **≥ 90%** of paired block-bootstrap resamples, 1991–latest (21-day blocks, 1,000 draws; 90% because three variants are tested) |
| C3 | Worst drawdown no more than 2 points deeper than v5's |

Also reported, not deciding: the median 3-month rebound capture after the ten major lows used
in §19 (and earlier), equity weight at the close before the 2008-10, 2018-02, 2020-02 and
2025-04 shocks, CAGR, average equity, cost drag, and 60/40.

**Verdict:** a variant passes if C1–C3 hold. If more than one passes, the one with the higher
1991–latest Sharpe is chosen. A pass becomes an engine option and a *Risk budget, vol complex
(v8)* preset, with its own live record; the v5 preset and the v3 record are not changed. If
none passes, v5 stands.

## Amendment log
- 2026-11-05: VXO history (1986–1989) could not be downloaded (Cboe returned access denied), as
  §1 anticipated. Evaluation window 1991-01-30 (first date with every input) to 2026-11-03.
- 2026-11-05: run once (METHODOLOGY §21). W1, W2 and W3 fail C1 and C2; W1 and W3 also fail C3.
  **Verdict: none passes; v5 stands.**

