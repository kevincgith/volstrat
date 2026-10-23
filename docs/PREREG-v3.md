# VolStrat v3: pre-registration

Written 2026-10-23, **before** any v3 code, any European pipeline, or any result on European
data. The git commit that adds this file is its timestamp. Changes after that commit are
appended as dated amendments, never edited in place.

## 1. Goal

Beat a balanced 60/40 portfolio, and show it on data the design never saw.

Why a redesign: the current strategy beat 60/40 on 2007–2026, where it was designed, but
trailed it on 1993–2006 (Sharpe 0.18 vs 0.51, METHODOLOGY §15.8). It switches between
extremes (0–200% equity) on volatility signals, and is blind to long, high-volatility bear
markets and booms.

## 2. Data roles

| Role | Data | Use |
|---|---|---|
| Design check | United States, 1993–2026 (both eras) | Check the frozen spec; at most one revision round (§5) |
| **Holdout** | **Europe, 1999–2026** | Run **once**, on the frozen design; reported whatever the result |
| Forward test | Live record v3 (only if §6 is met) | Daily, append-only, like v1/v2 |

Every US year has now been seen, so US results alone cannot prove anything. Europe has not
been looked at. Until the holdout run, only data checks are allowed on European data: coverage,
gaps, spikes, and cross-source agreement. No signal or strategy statistic may be computed on it.

### European data (decided 2026-10-23)

| Need | Source | Notes |
|---|---|---|
| Volatility index | VSTOXX (STOXX `h_v2tx.txt`), 1999– | |
| Volatility curve | VSTOXX 1M / 3M sub-indices (STOXX `h_vstoxx.txt`), 1999 to 2016-02 | Drops out after 2016-02 (§3.2 renormalises) |
| Equity | Euro Stoxx 50 price index: STOXX file to 2016, Yahoo `^STOXX50E` from 2007 (overlap used to check the join), plus **estimated dividends of 3.0% a year** | Synthetic total return. **Check:** the DAX (a total-return index, Yahoo `^GDAXI`) as the equity, with the same signals |
| Bonds | Synthetic 7–10y government bond return from yields: ECB AAA euro-area curve, 7-year spot rate, daily from 2004-09; German 10y yield, monthly, before that (monthly returns spread evenly over the month's trading days) | Pre-2004 bond returns are smoothed. Signals never use bond data, so decisions stay causal |
| Cash | ECB: EONIA 1999–2019-09, then €STR | |
| Costs | 5 bp per side, as in the US | |

The 60/40 benchmark uses the same equity and bond series, rebalanced monthly.

## 3. The v3 design (frozen)

Every number below is fixed now. Round, conventional values were chosen on principle, not
fitted.

### 3.1 Allocation: tilt around 60/40
- Equity weight = **0.60 + 0.20 × s**, where s ∈ [−1, +1] is the combined signal. The range
  is 40–80% equity.
- The rest is in 7–10y government bonds: IEF in the US (VFITX before 2002), the synthetic
  bond in Europe.
- No leverage, no gold, no utilities, no T-bill regime.
- Rebalance at the close of the last trading day of each week, only if the equity weight is
  more than **5 points** off target. The signal at close t trades at close t+1, as now.

### 3.2 Signal: three pillars, equally weighted
s = (P1 + P2 + P3) / 3, with each pillar in [−1, +1] (+1 = more equity). Each pillar uses only
data up to the close of t.

**P1, volatility stress.** These components exist in both markets:
- implied volatility level (VIX / VSTOXX): high = stress;
- volatility curve, 1-month / 3-month (VIX/VIX3M; VSTOXX 1M/3M sub-indices): high = stress;
- variance risk premium: implied vol minus 21-day realised vol of the index; low = stress.

Each is ranked against **its whole history to date** (expanding window, at least 252 days)
rather than the last 3 years. That fixes the "a VIX of 22 looks calm after three volatile
years" failure. Ranks are oriented so that 100 = calm. When a component is missing, the others
are averaged.

P1 = (average oriented rank − 50) / 50.

**P2, trend.**
P2 = clamp((index / its 200-day simple average − 1) / 0.10, −1, +1).
So ±10% from the average saturates the pillar.

**P3, volatility scaling** (Moreira & Muir, 2017). Let RV = the index's 21-day realised
volatility, and M = the median of RV over all history to date (at least 252 days).
P3 = clamp(log₂(M / RV), −1, +1).
Half the usual volatility gives +1; double gives −1.

The pillars use different data and fail in different ways. In the US, trend was correctly
negative through 2000–2002 and 2022, where the volatility signals failed.

### 3.3 Deliberately left out
- The panic-rebound rule, credit, put/call, SKEW and VVIX: they don't exist in Europe, and
  each adds settings. On 2007–2026 the reduced US set matched the full model (§15.8).
- Signal smoothing: the 5-point band and the weekly check already limit trading.

## 4. Definition of "proven"

The benchmark is 60% equity / 40% the same 7–10y bonds, in the same market, with the same
costs, rebalanced monthly.

| # | Criterion | Data |
|---|---|---|
| A | Sharpe above the benchmark in **both** 1993–2006 and 2007–2026 | US |
| B | Worst drawdown no deeper than the benchmark's in either US era | US |
| C | Sharpe above the benchmark in **≥ 90%** of paired block-bootstrap resamples (21-day blocks, 1,000 draws), whole period | US 1993–2026 |
| D | Sharpe above the benchmark, and in **≥ 90%** of paired bootstrap resamples | **Europe 2000–2026**, one run |
| E | Worst drawdown no deeper than the benchmark's | Europe |
| F | The DAX check gives the same verdict as D | Europe |

**Verdicts:**
- **Proven:** A–F all hold. v3 then becomes the default, and live record v3 starts.
- **Supported:** A–C hold and D's point estimate is positive, but its bootstrap share is 75–90%
  or E or F fails. v3 becomes a preset, and live record v3 starts.
- **Not supported:** anything else. It's reported as such, and the defaults are unchanged.

Also reported, though they don't decide the verdict: CAGR, return per unit of risk, turnover,
cost drag, information ratio against the benchmark, and results by year.

The Europe holdout starts in 2000 because the expanding ranks need 252 days of VSTOXX history.

## 5. Process

1. Build the v3 engine with look-ahead tests, and the European data pipeline with checks only.
2. Run the frozen spec on the US (§4 A–C).
3. **If A–C fail:** one revision round is allowed.
   - Grid, declared now: tilt range {0.15, 0.20, 0.25} × trend saturation {0.05, 0.10} ×
     pillar weights {equal; P1 at half weight} = 12 combinations.
   - Objective: the *worse* of the two US eras' Sharpe excess over the benchmark.
   - The grid winner is re-checked against A–C, and the number of trials (12) is reported.
   - If it still fails A–C, stop. Europe is then run only to report the result.
4. Run Europe once with the frozen (or once-revised) design. No changes after seeing it.
5. Write up everything, including failures, in METHODOLOGY §16.

## 6. Commitments

- Every US run is logged, with its parameters, in METHODOLOGY §16.
- European data is not used for any decision before step 4.
- If v3 is "not supported", that is the answer, not the start of another search on the same
  data.

## Amendment log
- 2026-10-23: US design check run once with the frozen parameters; A, B and C passed, with
  no revision round (METHODOLOGY §16.2). The DAX check was implemented with the signals
  unchanged and only the equity sleeve replaced, the literal reading of §2, decided before
  the European run.
- 2026-10-23: European holdout run once. D fails (Sharpe 0.25 vs 0.25, bootstrap 44%); E and
  F pass. **Verdict: not supported** (METHODOLOGY §16.3).
