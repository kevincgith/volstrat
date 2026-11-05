# VolStrat v9: a multi-asset risk budget (pre-registration)

Written 2026-11-05, before any v9 code or result. Changes after the commit that adds this file
are appended as dated amendments.

## 1. Why

v5 sizes one asset, US equity, by its own volatility. Every refinement since (v7, v8) tried to
measure that same risk better and moved the Sharpe ratio by at most ±0.04: one signal on one
asset is close to its limit. The well-documented way to raise return per unit of risk is to add
return streams that do not move with US stocks and size **each** by its own risk: risk parity
with a trend filter, applied across asset classes (Hurst, Ooi & Pedersen 2017; Asness, Frazzini
& Pedersen 2012 on risk parity). VolStrat has never tested it; the asset universe added on
2026-11-04 makes it possible.

**Honest limit.** The test period (2007–2026) has been used for US equity designs many times,
although never for this multi-asset structure, and the sleeves were chosen as standard asset
classes, not by their performance. Gold's strong 2019–2026 run is in the sample.

## 2. The rule (frozen)

**Sleeves (6):** US equity (SPX), developed ex-US equity (EFA), emerging-market equity (EEM),
7–10y Treasuries (IEF), gold (GLD), commodities (DBC). Cash: T-bills (BIL).

At the close of the last trading day of each month, using data up to that close:
1. σ_i = annualised standard deviation of sleeve i's last 63 daily returns.
2. Raw weight r_i = (1 / σ_i) / Σ_j (1 / σ_j): inverse-volatility weights summing to 100%.
3. Trend brake: if sleeve i's total-return index is below its 200-day simple average, its
   weight is halved; the freed weight goes to T-bills.

Trade at the next close, 5 bp per side. No leverage. No VolStrat score, no regimes.

## 3. Criteria (2007-01-01 to latest)

Comparisons: v5 (the Risk budget preset) and 60/40 (S&P 500 / AGG, monthly), same days.

| # | Criterion |
|---|---|
| C1 | Sharpe above v5 in **both** 2007–2016 and 2017–latest |
| C2 | Sharpe above v5 in **≥ 80%** of paired block-bootstrap resamples (21-day blocks, 1,000 draws) |
| C3 | Worst drawdown no deeper than v5's |
| C4 | Sharpe above v5 **without gold** (five sleeves), whole period: the result must not depend on one asset's run |

Also reported, not deciding: CAGR, volatility, average weights, turnover, cost drag, the
2008, 2020 and 2022 drawdowns, the version without the trend brake, and v9 scaled to v5's
volatility (excess return × v5 vol / v9 vol, financing at T-bills).

**Verdict:** pass if C1–C4 hold. A pass becomes an engine mode and preset (*Multi-asset risk
budget (v9)*) with its own live record; the v5 preset and record are unchanged. Otherwise fail,
reported as such.

## Amendment log
- 2026-11-05: run once (METHODOLOGY §22.2). C1, C2 and C4 fail; C3 passes. **Verdict: fail.**
