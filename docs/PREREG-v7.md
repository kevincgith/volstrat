# VolStrat v7: the risk budget abroad, and four refinements (pre-registration)

Written 2026-11-05, before downloading the regional data and before any result. Changes
after the commit that adds this file are appended as dated amendments.

## 1. Why

v5 (METHODOLOGY §18) passed on US 1927–1989. US data are now heavily used: more than 30 designs
on 1993–2026, and v5 on 1927–1989. The only clean tests left are other markets. This test asks
two questions on markets the project has never used:

1. **Does the core idea travel?** Does v5 beat a static mix with the same average exposure
   outside the US?
2. **Do any of four standard refinements improve it?** Each changes one element of v5 and
   comes from the literature, not from VolStrat's data.

## 2. Data

Ken French data library, daily regional market returns in US dollars (market excess return
plus the US one-month T-bill rate), from July 1990:

| Region | Role |
|---|---|
| Japan | **decisive, never used** |
| Asia Pacific ex Japan | **decisive, never used** |
| Europe | decisive, but partly seen: v3 used the Euro Stoxx 50 for 2000–2026 (§16) |
| US 1927–1989 (French) and US 1993–2026 (engine) | checks only, already seen |

Returns are in US dollars, so they include currency moves; cash is the US T-bill. Before the
run, only data checks are allowed: coverage, gaps and spikes. Evaluation starts once 200 days
of history exist (1991).

## 3. Rules (frozen)

All variants trade like v5: decide at the close, trade at the next close when the equity
weight is more than 10 points off target, 5 bp per side, no leverage, rest in T-bills (no
regional bond data). The trend index is the region's total-return index.

| Variant | Equity weight before the trend brake | Trend brake |
|---|---|---|
| **V0 (v5)** | min(1, 12% / σ21) | halve below the 200-day average |
| **V1 EWMA** | min(1, 12% / σEWMA), σEWMA with λ = 0.94 (RiskMetrics) | as V0 |
| **V2 HAR blend** | min(1, 12% / σHAR), σHAR = (σ5 + σ21 + σ63) / 3 (Corsi 2009) | as V0 |
| **V3 adaptive target** | min(1, m / σ21), m = expanding median of σ21 (at least 252 observations) | as V0 |
| **V4 two-speed brake** | as V0 | halve only while below **both** the 50- and 200-day averages |

σ values are annualised with √252. σ5, σ21 and σ63 are standard deviations of the last 5, 21
and 63 daily returns.

## 4. Criteria

**Question 1, the core idea abroad.** Against a static mix of the region's equity and T-bills
at V0's own average equity weight (rebalanced monthly), in each of the three regions:
- Q1a Sharpe higher;
- Q1b worst drawdown shallower.

The core idea **travels** if Q1a and Q1b hold in at least two of the three regions, including
at least one of Japan and Asia Pacific ex Japan.

**Question 2, refinements.** A variant **improves on v5** if, against V0:
- R1 its Sharpe is higher in at least two of the three regions, including at least one of
  Japan and Asia Pacific ex Japan;
- R2 it beats V0 in **at least 90%** of paired block-bootstrap resamples (21-day blocks, 1,000
  draws) in at least two regions. The bar is 90% rather than 80% because four variants are
  tested;
- R3 its Sharpe on US 1927–1989 and US 1993–2026 is not lower than V0's by more than 0.03.

A variant that passes becomes an engine option; at most one may change the v5 preset, and
the live record v3 is never altered (a change would start a new record). If more than one
passes, the one with the highest median Sharpe gain across the three regions is chosen.

## 5. Disclosure

The refinements are standard (RiskMetrics 1996; Corsi 2009; Bongaerts, Kang & van Dijk 2020
on acting mainly in high-volatility states; Goulding, Harvey & Mazzoleni 2023 on fast and
slow trend). V4 was chosen knowing that v4 and v5 miss V-shaped rebounds in US data.

## Amendment log
- 2026-11-05: data checks passed (no gaps or missing values; spikes are known events). Common
  evaluation start 1992-03-24 (V3 needs 252 volatility observations after the 200-day warm-up);
  the US 1927–1989 check therefore starts 1928-01-03.
- 2026-11-05: run once (METHODOLOGY §20). Q1: the core idea travels (Asia Pacific ex Japan
  and Europe pass; Japan fails on Sharpe). Q2: V1–V4 all fail R2. v5 unchanged.

