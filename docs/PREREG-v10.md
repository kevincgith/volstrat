# VolStrat v10: the risk budget plus capitulation re-entry (pre-registration)

Written 2026-11-05, before any v10 code or result. Changes after the commit that adds this
file are appended as dated amendments.

## 1. The missing part

Measured on US 1993–2026 before this test (METHODOLOGY §22): on days after 21-day volatility
was above 25% (11% of days) the S&P 500 earned 7.1% a year at 36.4% volatility, against 11.2%
at 14.8% on calm days, and 15 of the 20 worst days came in that state. **Exiting stress is
right.** But 19 of the 20 best days also came in it, and the market recovers before volatility
does: after the lows of 2009-03-09 and 2020-03-23, 21-day volatility first fell back below 25%
on 20 May, when the S&P 500 was already up 33.8% and 33.2%.

v5 waits for volatility and trend to normalise. What it lacks is a signal that the panic is
over **before** volatility settles. The VIX term structure has one: a deep inversion of
VIX/VIX3M that has normalised marks capitulation. It is the only timing rule that has worked in
this project (§15.2: test-period Sharpe +0.09, better in 92% of resamples; §15.5).

**Honest limit.** That rule was fixed on 2026-10-23 and tested on 2007–2026; this test reuses
the same period, so it cannot be fully independent. VIX3M exists from 2006-07, so the rule is
inactive before 2006.

## 2. The rule (frozen; no new settings)

v5 exactly (12% target, 21-day volatility, 200-day trend brake, IEF/T-bill switch, 10-point
band), plus the panic-rebound override as fixed on 2026-10-23 (§15.2): if VIX/VIX3M was above
1.10 within the last 20 trading days and is now below 1.00, an override starts and lasts 20
trading days; a new reading above 1.10 cancels it. **While the override is active, the equity
weight is at least 80%** (Growth's Neutral equity, the override's target since 2026-10-23); the
rest follows v5's defensive rule.

Also reported, not deciding: the "held" exit of §15.5 test 2 (the override lasts until
VIX/VIX3M is back at 1.00 or above, the S&P 500 closes below its lowest close of the previous
20 days, or v5's own weight reaches 80%).

## 3. Criteria (2007-01-01 to latest, against v5 on the same days)

| # | Criterion |
|---|---|
| C1 | Sharpe above v5 in both 2007–2016 and 2017–latest |
| C2 | Sharpe above v5 in ≥ 80% of paired block-bootstrap resamples (21-day blocks, 1,000 draws) |
| C3 | Worst drawdown no more than 2 points deeper than v5's |
| C4 | Median 3-month rebound capture after the ten major lows above v5's |

**Verdict:** pass if C1–C4 hold. A pass becomes an option of the risk-budget mode and a preset
(*Risk budget + re-entry (v10)*) with its own live record; the v5 preset and the v3 record are
unchanged.

## Amendment log
- 2026-11-05: run once (METHODOLOGY §22.3). C1, C2 and C4 fail; C3 passes. **Verdict: fail.** The "held" exit (reported only) reached Sharpe 0.72, better than v5 in 82% of resamples; it was not the pre-registered rule and is not adopted.
