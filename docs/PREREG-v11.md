# VolStrat v11: finding a re-entry signal (pre-registration)

Written 2026-11-05, before any v11 code or result. Changes after the commit that adds this file
are appended as dated amendments.

## 1. Question

v5 waits for volatility and the 200-day trend to recover, which comes weeks after the low
(METHODOLOGY §22). The capitulation signal of v10 caught sharp panics but not grinding bottoms
(2009, 2011, 2022) and re-entered too early in 2008. Research (`research_notes/Re-entry after
market sell-offs/`) points to price-based signals with long history: fast-versus-slow trend
states (Goulding, Harvey & Mazzoleni 2023), reclaiming a short trend, momentum thrusts (the
price analogue of breadth thrusts, which need data not freely available), and follow-through
days (Quantifiable Edges' independent test). Breadth and credit are left out for lack of long,
free data; VIX signals are measured on 1990–2026 for description only.

## 2. Design: discover on one period, validate on another

- **Stress days:** days when v5's trend brake is on (equity index below its 200-day average)
  and v5's equity weight is below 50%.
- **Discovery: US 1928–1989** (Ken French daily market returns). For each candidate, over the
  stress days on which it is active, measure the mean forward 63-day market return and the share
  of those days followed by a 63-day loss worse than −10% ("false alarm"), against the same
  statistics for all stress days.
- **Selection rule (fixed now):** among candidates active on at least 5% of stress days, keep
  those whose false-alarm share is no higher than all stress days'; pick the one with the
  highest mean forward 63-day return. If none qualifies, stop: no re-entry signal is adopted.
- **Validation: US 1993–2026** (engine data, v5 exactly as the preset). v11 = v5, but **while
  the selected signal is active the trend brake is not applied** (the volatility budget still
  sizes the position).

## 3. Candidates (frozen definitions)

All use the equity total-return index up to the close of day t.

| # | Candidate | Active when |
|---|---|---|
| P1 | Rebound state (fast/slow trend) | 252-day return < 0 and 42-day return > 0 |
| P2 | Short trend reclaimed | index above its 50-day average (while below its 200-day average) |
| P3 | Momentum thrust | 10-day return at or above the 95th percentile of all 10-day returns to date (expanding, at least 1,000 days), and for the following 20 days |
| P4 | Follow-through day | on day 4–10 after the lowest close of the last 20 days, a daily gain of at least 1.7%; active for the following 20 days, cancelled by a close below that low |
| D1 | *Descriptive only, 1990–2026:* VIX capitulation | VIX/VIX3M above 1.10 within 20 days and now below 1.00 (§15.2), for 20 days |

## 4. Validation criteria (1993-01-01 to latest, against v5 on the same days)

| # | Criterion |
|---|---|
| C1 | Sharpe above v5 in both 1993–2006 and 2007–latest |
| C2 | Sharpe above v5 in ≥ 80% of paired block-bootstrap resamples (21-day blocks, 1,000 draws) |
| C3 | Worst drawdown no more than 3 points deeper than v5's |
| C4 | Median 3-month rebound capture after the major lows (2002-10-09 and the ten of §22) above v5's |

Also reported: the same v11 on 1928–1989 (the discovery period, so not evidence), and every
candidate's discovery statistics.

**Verdict:** pass if a candidate is selected and C1–C4 hold. A pass becomes a risk-budget option
and a preset with its own live record; the v5 preset and the v3 record are unchanged.

## Amendment log
- 2026-11-05: discovery on 1928–1989 selected P4 (follow-through day): mean forward 63-day return
  4.96% against 2.44% on all stress days, false alarms 16.9% against 17.6%. Validation on
  1993–2026: Sharpe 0.64 against 0.65 (1993–2006 0.56 vs 0.60, 2007–2026 0.69 vs 0.69),
  bootstrap 30%, drawdown −20.6% vs −20.4%, rebound capture 27.3% vs 25.9%. C1 and C2 fail.
  **Verdict: fail** (METHODOLOGY §23).

