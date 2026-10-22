# VolStrat methodology

This document is filled in phase by phase. Sections marked *(Pn)* are written in that phase.

## 1. Objective

The goal is to build a daily composite *risk-appetite score* from volatility, options-sentiment and
credit/financial-conditions indicators, and to map it to a tactical allocation between risk assets
(the S&P 500, unlevered or 2×/3× levered, and MSCI World) and defensive assets (Treasuries, T-bills,
gold, utilities). The aim is to cut drawdowns in stress regimes while keeping most of the upside in
calm ones.

## 2. Data sources

Every source was verified by direct download on 2026-10-22. Dates are the first observation
actually received.

### 2.1 Cboe volatility indices
Source: `https://cdn.cboe.com/api/global/us_indices/daily_prices/{SYMBOL}_History.csv`. It
redirects (HTTP 307) to `cdn-api.cboe.com`. Cboe is the primary source; Yahoo is the fallback and
fills early history.

| Index | Measures | Cboe start | Yahoo start | Notes |
|---|---|---|---|---|
| VIX | 30-day implied vol of the S&P 500 | 1990-01-02 | 1990-01-02 | Cboe has 33 dates missing on Yahoo |
| VIX9D | 9-day implied vol | 2011-01-04 | 2011-01-03 | |
| VIX3M | 3-month implied vol | 2009-09-18 | 2006-07-17 | Joined: Yahoo before 2009-09-18 (the legacy `VXV` file returns 403) |
| VIX6M | 6-month implied vol | 2008-01-02 | 2008-01-02 | |
| VVIX | Implied vol of VIX options ("vol of vol") | 2006-03-06 | 2007-01-03 | Close only |
| SKEW | Tail-risk pricing from out-of-the-money S&P puts | 1990-01-02 | 1990-01-02 | 13-day gap in Oct 2000 |
| MOVE | Implied vol of US Treasuries (ICE) | none | 2002-11-12 | Yahoo only; gaps of 6 and 10 days in 2012–13. Optional component. |

### 2.2 VIX futures (CFE)
- 2004–2013: `https://cdn.cboe.com/resources/futures/archive/volume-and-price/CFE_{M}{YY}_VX.csv`
- 2013 onwards: a product list at
  `https://www.cboe.com/us/futures/market_statistics/historical_data/product/list/VX/` plus one CSV
  per contract at `https://cdn.cboe.com/data/us/futures/market_statistics/historical_data/VX/VX_{expiry}.csv`.

Assembled coverage runs from **2004-03-26** to today. Known issues that the pipeline corrects:
1. **Price scale.** Before the March 2007 redenomination, futures were quoted at 10× the VIX
   (a 2004 median settle of about 180). They are divided by 10.
2. **Zero settles.** In the 2013+ feed, 38% of 2013 rows have `Settle = 0`, up to 2013-05-17. The
   archive is used for every contract expiring in 2013 or earlier.
3. **Malformed rows.** Four archive files contain rows with 12 fields instead of 11. They are parsed
   tolerantly and the dropped rows are logged.
4. **Sparse early ladder.** 2004–05 has only about 4 listed contracts, so constant-maturity
   interpolation spans wider gaps there.

**Construction** (`pipeline/volstrat_pipeline/build/vx.py`). All calculations use daily
settlement prices and calendar days to expiry (DTE).
- **Live contracts on date t:** monthly contracts with expiry strictly after t. On its expiry
  date a contract settles to the special opening quotation (SOQ) and is no longer part of the
  curve.
- **VX1 / VX2:** the first and second live contracts. They therefore roll on each expiry date.
- **Constant maturity CM(T), T ∈ {30, 60, 90}:** linear interpolation in DTE between the two
  points bracketing T. Spot VIX is used as the 0-DTE point, so CM30 is defined even when VX1
  has less than 30 days left. There is no extrapolation beyond the last listed contract.
- **Curve snapshots:** up to 9 live contracts per day (DTE, settle) are exported for the
  term-structure chart.
- **Check:** VX1/VIX has a median of 1.00–1.10 in every year from 2004 to 2026, with no
  break at the 2007 rescaling.

### 2.3 Put/call ratios (Cboe)
Four files are joined: equity and total from **2003-10-17** (total from 1995), index from
**2006-11-01**. Where files overlap, the newer one wins.

| File | Coverage |
|---|---|
| `pcratioarchive.csv` | 1995-09-27 → 2003-12-31 (total only) |
| `{equity,index,total}pcarchive.csv` | 2003-10-17 → 2012-06-07 |
| `{equity,index,total}pc.csv` | 2006-11-01 → 2019-10-04 |
| `https://cdn.cboe.com/data/us/options/market_statistics/daily/{date}_daily_options` (JSON) | 2019-10-07 → today |

**Index P/C starts in 2006.** Over 2006–2012 the older `indexpcarchive.csv` runs about 0.1
higher than `indexpc.csv`, with a daily correlation of only 0.72, which points to a different
product universe. Joining them would create an artificial level shift, so the index ratio uses
only the newer file and the daily JSON. Equity and total ratios agree closely across files
(99th-percentile absolute difference about 0.07, consistent with preliminary vs cleared volume).

Caveats: these are Cboe-only volumes, and there are structural breaks (retail call buying in
2020–21; 0DTE SPX options since 2022). Rolling percentiles therefore matter more here than levels.

### 2.4 Tradeable assets (Yahoo Finance, dividend-adjusted)
| Sleeve | ETF (start) | Pre-inception extension |
|---|---|---|
| S&P 500 | SPY (1993-01-29) | `^SP500TR` total-return index (1988-01-04) |
| 2× / 3× S&P | SSO (2006-06-21) / UPRO (2009-06-25) | Synthetic: L × index return − (L−1) × (T-bill + spread) − expense ratio |
| MSCI World | URTH (2012-01-12) | `^990100-USD-STRD` price index (1972) + estimated dividend yield. It closes before the US market, so its daily correlation with URTH is only about 0.89. |
| Intermediate Treasuries | IEF (2002-07-30) | VFITX (1991) |
| Long Treasuries | TLT (2002-07-30) | VUSTX (1986) |
| Aggregate bonds | AGG (2003-09-29) | VBMFX (1986) |
| 1–3y Treasuries | SHY (2002-07-30) | 3-month T-bill accrual |
| Cash | BIL (2007-05-30) | 3-month T-bill accrual |
| Gold | GLD (2004-11-18) | `GC=F` front future (2000-08-30). No verified free daily series before 2000. |
| Utilities | XLU (1998-12-22) | FSUTX (1981) |

Joined (spliced) segments are flagged in the data and shaded on charts.

### 2.5 Rates, credit and financial conditions
- **US Treasury daily par yield curve** (`home.treasury.gov` CSV, 1990 → today) is the primary
  source for the 3-month bill, 2-year, 10-year and the 10y–2y slope.
- **FRED** (`fredgraph.csv`, no API key) is used for the ICE BofA HY and IG OAS, NFCI and STLFSI4.
  It could not be verified from the development machine (connection refused) and will be verified
  on the first GitHub Actions run. Fallbacks: credit stress from HYG/LQD total return relative to
  IEF (extended back with VWEHX vs VFITX). NFCI and STLFSI4 are optional and disabled if they're
  unavailable. Chicago Fed's own NFCI CSV is stale (last observation 2026-04-24).

### 2.5a End-of-day only: no live or provisional prices
Intraday and provisional values must never reach the signal or the backtest. During US
trading hours Yahoo's bar for today is a live price, and right after the close vendors
still revise closing-auction prints and settlements. Rules (`sources/base.py`, `eod_cutoff`):

1. **Cutoff.** Data dated D is accepted only once New York time has passed **18:00 on D**.
   Before that, the latest accepted date is the previous business day (weekends roll back to
   Friday). Every source (Cboe, CFE, put/call, Treasury, Yahoo, FRED) drops rows after the
   cutoff, and the put/call fetcher never requests a day beyond it.
2. **Re-confirmation.** The last 5 days are re-downloaded and replaced on every run (Yahoo
   tail refresh, put/call daily files, live VX contracts, current-year Treasury file, full Cboe
   index files), so a late correction overwrites the stored value. Only older history is
   frozen.
3. **Timing.** The evening run is at 23:30 UTC (19:30 EDT / 18:30 EST), after the cutoff.
   The morning catch-up (11:15 UTC) uses the previous day.
4. **Disclosure.** The cutoff of the last fetch is published in `meta.json` and on the
   Dashboard.
5. **Past-week reconciliation.** Every run compares the freshly downloaded values for the
   last 5 business days with the stored ones, for each source: Cboe index closes, VX
   settlements per contract, put/call ratios, Treasury yields, Yahoo unadjusted closes.
   - Changed values are recorded with their old and new values (`revisions` in each
     source's status), printed in the Action log and shown on the Dashboard.
   - A day that is stored but missing from the new download (seen with Yahoo during US
     trading hours) is reported separately, and the stored end-of-day value is kept.

### 2.6 Point-in-time alignment (no look-ahead in the data)
Each series is placed on the trading calendar (NYSE days, taken from `^GSPC`) on the date its
value became **available**, not the date it describes
(`pipeline/volstrat_pipeline/build/align.py`):

| Series | Availability lag | Why |
|---|---|---|
| Cboe indices, VX settlements, put/call, S&P 500, MOVE | same day | Published by the close or the same evening; trades happen at the next close or later |
| Treasury yields | +1 business day | Published late in the afternoon; lagged to be conservative |
| ICE BofA OAS, Baa–10y | +1 business day | FRED publishes them the next morning |
| NFCI | +5 calendar days | Friday-dated, released the following Wednesday |
| STLFSI4 | +6 calendar days | Friday-dated, released the following Thursday |

A value is treated as missing once it is more than 7 calendar days stale (14 days for the
weekly series). Tests check that no value is ever visible before its availability date.

### 2.7 Asset total-return chains
Each asset is a priority list of sources (`build/assets.py`). The ETF is used from its first
return onwards. Each extension only fills dates **before** the higher-priority source starts,
and it never fills isolated gaps afterwards. Daily returns are chained into an index starting
at 1.0, so history doesn't shift when Yahoo re-adjusts prices for a new dividend. The cash
leg accrues the previous day's 3-month bill yield × calendar days / 360. Every proxy segment
is flagged `synthetic` and shaded on charts. Leveraged ETFs are shipped only from inception;
the browser engine builds the synthetic pre-inception history so that the financing spread
and expense ratio can be set as parameters.

### 2.8 Pipeline guards
- A cache is never replaced by data that is empty, has fewer rows or ends earlier.
- History that should be immutable must not change by more than 1% of values. For
  dividend-adjusted prices this is checked on returns, not levels.
- Values outside plausible ranges are removed and reported. If too many are, the source
  fails, since that usually means the file format changed.
- Any value dated after the end-of-day cutoff (§2.5a) is dropped from every source.
- **Stable caches:** Yahoo re-rounds adjusted prices on every download (moves of up to 3e-6
  in past returns). The stored history is kept unchanged and only new days are chained on,
  rescaled so their returns match Yahoo's. This keeps daily commits to a few lines instead
  of about 112,000. A stock split, which restates unadjusted closes, replaces the history.
- **Cross-source checks** run on every build. Results go in `meta.json` and on the Dashboard:
  - the trading calendar is up to date with Cboe;
  - VIX3M and VVIX agree between Cboe and Yahoo (median gap < 1%);
  - SPY returns track the S&P 500 TR index (60-day correlation > 0.99, median gap < 10 bp);
  - VX1/VIX is within 0.6–1.8;
  - key series are no more than 3 business days stale;
  - no asset has an implausible daily move.
- **Alerts:** a failing required source opens one `data-failure` issue per outage. Later
  failures comment on it, and it closes automatically once a run succeeds.
- Required sources (Cboe indices, VX, Treasury, core Yahoo tickers) fail the daily job and
  open a GitHub issue. Optional ones (put/call, FRED, proxies) fall back to cached data and
  are flagged in `meta.json`.

### 2.9 Effective sample
- **Full signal set:** from mid-2006, limited by VVIX and VIX3M. After a one-year standardisation
  warm-up, the default backtest starts around mid-2007 and includes 2008.
- **Long history:** from 1990 with a reduced component set. Components without data on a given
  date are excluded and the remaining weights are rescaled to sum to 1.

## 3. Signal components
The registry is in `web/src/engine/components.ts`. Each component computes one raw feature per
day from point-in-time inputs. "Direction" says which way is stress; the engine flips features
so that **100 = risk-on**, and any component's direction can be inverted in the UI (for
example to read put/call as a contrarian signal).

| Component | Raw feature | Stress when | Default weight | First data |
|---|---|---|---|---|
| VIX level | VIX | high | 1 | 1990 |
| VIX term structure | VIX / VIX3M | high (inverted curve) | 1 | 2006-07 |
| VIX futures slope | VX CM30 / CM60 | high (backwardation) | 1 | 2004-03 |
| VX1/VX2 | VX1 / VX2 | high | off | 2004-03 |
| VVIX | VVIX | high | 0.5 | 2007-01 |
| SKEW | SKEW | high (ambiguous, see note) | 0.25 | 1990 |
| Equity put/call | 10-day average | high | 0.5 | 2003-10 |
| Variance risk premium | VIX − 21-day realised vol of the S&P 500 | low / negative | 1 | 1990 |
| Credit (ETF) | 63-day log return of HYG minus IEF (Vanguard HY fund before 2007) | low | 1 | 1991 |
| Credit (OAS) | 63-day change in ICE BofA HY OAS | high (widening) | 1 | FRED |
| Trend | S&P 500 / 200-day average − 1 | low | 1 | 1990 |
| MOVE | MOVE | high | off | 2002-11 |
| NFCI / STLFSI | index level | high | off | FRED |
| Curve | 10y − 2y | low (inverted) | off | 1990 |

Notes:
- The VRP uses past realised volatility, so it is known on the day. The academic definition
  uses future realised volatility, which a trading signal cannot.
- **SKEW** is weighted low because its link to subsequent stress is weak and sometimes
  reversed: it often falls *during* crashes.
- The VIX futures slope uses constant-maturity points rather than VX1/VX2 because the latter
  jumps at every monthly roll.

## 4. Standardisation: trailing windows only
Each raw feature is converted to a 0–100 score using **only past and current
observations** (`web/src/engine/stats.ts`):
- **Percentile (default):** rank of today's value among the finite values in the trailing
  window (default 756 trading days ≈ 3 years), with ties counted as half. A window of 0 means
  expanding.
- **Z-score:** (x − trailing mean) / trailing standard deviation, mapped through the normal
  CDF to 0–100. It is more sensitive to extremes than the percentile rank.
- A component is only used once it has at least `minPeriods` observations (default 252).

Full-sample normalisation is never used, because it would leak future information.

## 5. Composite score, smoothing and hysteresis
- **Composite:** the weighted average of the oriented component scores **available on that
  day**. Weights are rescaled to sum to 1 over those components. If less than `minCoverage`
  (default 50%) of the enabled weight is available, the score is undefined and no position
  is taken.
- **Smoothing:** an optional EMA with span N (default 5 days).
- **Regimes:** four cut-offs (default 20/40/60/80) define Crisis, Risk-Off, Neutral, Risk-On
  and Strong Risk-On. With **hysteresis** h (default 2.5 points) the regime only changes once
  the score crosses a cut-off by more than h, which cuts whipsaw near the boundaries. A large
  move can jump several regimes at once.
- **Calibration caveat:** averaging several roughly independent percentile scores pulls the
  composite toward 50. With the default cut-offs, Strong Risk-On occurred on only ~2% of days
  from 2007 to 2026, and Crisis on ~7.5%. The cut-offs were deliberately *not* tuned to the
  realised distribution, because that would be in-sample fitting. The share of time in each
  regime is shown with every backtest.

### 5.1 Whipsaw control: asymmetric buffers and minimum holding period
- **Asymmetric buffers.** `bufferUp` and `bufferDown` replace the symmetric hysteresis per
  direction. With a cut-off at 50, `bufferUp = 0` and `bufferDown = 5` switch to the higher
  regime as soon as the score crosses 50, and back only once it falls below 45. If neither is
  set, both default to `hysteresis`.
- **Minimum holding period.** `minHoldDays` blocks regime changes for N trading days after a
  switch. With `fastDerisk` (default on), moves toward risk-off are still allowed
  immediately, so the hold never delays protection.
- *Measured on default settings, data through 2026-10-21:*

| Setting | CAGR | Sharpe | Max drawdown | Trades | Cost drag |
|---|---|---|---|---|---|
| Default (2.5 / 2.5) | 7.4% | 0.60 | −21.8% | 205 | 0.61% |
| Up 0 / down 5 | 7.8% | 0.60 | −23.4% | 205 | 0.61% |
| Up 5 / down 0 | 6.7% | 0.57 | −22.9% | 210 | 0.61% |
| 20-day minimum hold | 7.0% | 0.57 | −21.8% | 171 | 0.52% |

  None of these changes risk-adjusted returns materially. They mainly trade turnover against
  responsiveness.

## 6. Allocation mapping
- **Regime mode (default):** each regime has its own editable portfolio. Defaults:
  - Crisis: 100% T-bills (BIL)
  - Risk-Off: 50% IEF, 25% GLD, 25% XLU
  - Neutral: 60% S&P 500, 40% IEF
  - Risk-On: 100% S&P 500
  - Strong Risk-On: 100% SSO (2×)
- **Continuous mode:** equity exposure moves linearly from `minEquity` at score ≤ `scoreLow`
  to `maxEquity` at score ≥ `scoreHigh` (defaults 0% at 20 and 150% at 80). Exposure up to
  100% is the S&P 500 plus the defensive mix (default 50% IEF / 25% GLD / 25% BIL). Above
  100% it is a fully invested blend of the S&P 500 and the leveraged ETF.
- **Presets:**
  - *Conservative:* no leverage, slower signal, 40/60 in Neutral.
  - *Balanced:* the defaults.
  - *Aggressive:* faster signal, 2× in Risk-On and 3× in Strong Risk-On.
  - *Continuous:* continuous mode.

### 6.1 Adaptive hedge (optional, off by default)
Treasuries hedge equities only when stock and bond returns are negatively correlated, as in
2008 and 2020. In an inflation or rate shock such as 2022 they fall together. When enabled,
the engine computes the trailing correlation of daily S&P 500 and IEF returns (default
63 days, using data up to the decision day only). While that correlation is above the
threshold (default 0), IEF, TLT and AGG in every target portfolio are replaced by T-bills,
or by SHY or gold if chosen.

Measured effect with default settings, data through 2026-10-21:

| | Default | Adaptive hedge |
|---|---|---|
| 2022 window return | −19.3% | −17.5% |
| Max drawdown | −21.8% | −20.1% |
| Sharpe | 0.60 | 0.60 |

2008 and 2020 are unchanged, and the result is insensitive to the threshold (0 or 0.2) and
to the replacement (T-bills or SHY). It stays off by default because the idea was prompted
by 2022, so its backtest benefit is partly hindsight.

## 7. Backtest assumptions
- **Timing:** the target is decided at the close of day *d* using data available by then
  (§2.6). It is traded at the **close of d + lag** (default lag 1, i.e. the next close), and the
  new weights earn returns from d + lag + 1. Lag must be at least 1. Execution at the next
  *open* is not available because the total-return series are close-to-close; next close is
  the conservative alternative.
- **Rebalancing:**
  - *On regime change* (default): trade only when the target portfolio changes.
  - *Daily, weekly or monthly:* trade to the latest target on the last trading day of each
    period, skipping trades where no weight is off target by more than the band (default 5%).
  - Weights drift with returns between trades.
- **Transaction costs:** `costBps` (default 5 bp) per unit of notional traded on each side. A
  full switch from one asset to another costs 2 × 5 = 10 bp.
- **Per-asset costs:** any asset can be given its own cost (bp per side), e.g. wider spreads
  on leveraged ETFs. Each leg of a trade is charged at its own rate.
- **Cost reporting:** *cost drag* is the annual cost paid as a % of NAV. The **break-even
  cost** is the cost per side, applied to every asset and to the benchmark alike, at which the
  strategy's Sharpe falls to the benchmark's (bisection over 0–200 bp).
  - *Example on 2026-10-22 data, default parameters:* the break-even vs 60/40 is **6.6 bp per
    side**. Sharpe falls from 0.66 at 0 bp to 0.60 at 5 bp, 0.54 at 10 bp and 0.41 at 20 bp,
    while 60/40 holds at about 0.58. Turnover of about 6× a year makes execution cost a
    first-order issue for this strategy.
- **Fees:** ETF returns are already net of expense ratios. Where a gross index, the T-bill
  accrual or the gold future stands in for an ETF, that ETF's expense ratio is deducted daily.
- **Leverage:** SSO and UPRO use actual ETF returns from inception. Before that (or always,
  if the user chooses) they are synthetic: L × S&P 500 TR − (L − 1) × (T-bill + spread) −
  expense ratio/252, rebalanced daily. Over 2006–2026 the synthetic 2× had a **0.997 daily
  correlation** with the real SSO and returned **0.26% a year more** at a 0.50% spread. The
  default spread is therefore set at **0.75%**, which roughly closes that gap.
- **Cash:** T-bill holdings earn the BIL ETF's return (3-month bill accrual before 2007).
- **Benchmarks:**
  - S&P 500 and MSCI World, buy and hold.
  - 80/20, 60/40 and 40/60 equity/bond portfolios (S&P 500 or MSCI World with AGG or IEF),
    rebalanced monthly.
  - Naive volatility targeting: S&P 500 weight = min(1, target vol / 21-day realised vol),
    the rest in T-bills, rebalanced weekly; default target 12%.
  - All benchmarks share the strategy's start date, lag and costs.
- **Start date:** the backtest starts at the later of the chosen date, the first date with a
  valid score, and the first date every asset used has returns. Any move is reported.

## 8. Performance metrics
| Metric | Definition |
|---|---|
| CAGR | (NAV_end / NAV_start)^(365.25 / calendar days) − 1 |
| Volatility | stdev of daily returns × √252 |
| Sharpe | mean / stdev of daily returns in excess of T-bills × √252 |
| Sortino | annualised mean excess return / (downside deviation of excess returns × √252) |
| Max drawdown | largest peak-to-trough fall in NAV |
| Calmar | CAGR / abs(max drawdown) |
| Ulcer index | √(mean of squared % drawdowns), which captures both depth and duration |
| Beta, correlation | against the S&P 500, daily returns |
| Turnover | one-way annual turnover (1.0 = whole portfolio traded once a year) |
| Average holding period | 1 / turnover, in years; average regime spell in days is reported separately |
| Hit rate | share of calendar months beating the S&P 500 |
| Worst month / year | calendar months and years |
| Up / down capture | geometric mean monthly return in S&P 500 up (down) months ÷ the S&P 500's |

## 9. Robustness and overfitting
A backtest is one path through history, and every parameter tried on that history is a test
of a hypothesis. The site has four tools to keep this honest
(`web/src/engine/robustness.ts`):

1. **In-sample / out-of-sample split.** Set an out-of-sample date and the statistics table
   shows each period separately, and the equity chart marks the split. The discipline:
   tune parameters only while viewing the in-sample period, then look at the out-of-sample
   period once.
2. **Sensitivity heatmap.** The full backtest is re-run for every combination of two
   parameters: smoothing, hysteresis, standardisation window, a shift or spread of the
   regime cut-offs, execution lag, costs, or minimum history. Everything else stays as
   configured, and all cells share one period. A robust configuration sits on a broad
   plateau; an isolated peak is a sign of overfitting.
3. **Walk-forward selection.** History is cut into test windows (6 months to 2 years). At
   the start of each one, the grid cell with the best objective (Sharpe, Sortino, Calmar or
   CAGR) over the **preceding** training window (3–10 years) is selected and held for the
   test window. The stitched series is out-of-sample with respect to the parameter choice,
   and a switching cost is charged whenever the chosen cell changes. If walk-forward does
   not beat fixed parameters out of sample, parameter tuning is not adding value.
   - *Example on 2026-10-22 data:* a 7×5 grid of smoothing × cut-off shift, 5-year training
     window, 1-year tests. Walk-forward gave Sharpe 0.48 against 0.70 for the fixed default
     parameters over the same 2012–2026 window, and the grid itself was a plateau (Sharpe
     0.40–0.67). Interpretation: the signal's value does not depend on fine-tuning, and
     tuning would have hurt.
4. **Multiple-testing yardstick.** For N configurations tried over T years, the expected
   best annualised Sharpe among N skill-less strategies is about
   E[max Z_N] / √T, with E[max Z_N] ≈ √(2 ln N) − (ln ln N + ln 4π) / (2√(2 ln N)). For
   35 cells over ~20 years that is about +0.44. Grid cells are correlated, so the effective
   N is smaller, but every configuration tried anywhere (including on the Compare page)
   counts. Differences between cells smaller than this are noise. (This is in the spirit of
   Bailey & López de Prado's deflated Sharpe ratio, simplified.)

5. **Bootstrap confidence.** A paired stationary block bootstrap (Politis & Romano;
   geometric blocks, mean 21 days; 1,000 resamples, seeded) resamples the strategy and
   benchmark on the *same* days. That keeps their correlation and the volatility clustering,
   and gives percentiles for the Sharpe and CAGR differences and both max drawdowns.
   - *Example on 2026-10-22 data, default parameters vs the S&P 500:* the strategy had the
     higher Sharpe in only 57% of resamples (Sharpe difference 5th–95th percentile −0.27 to
     +0.36), which is indistinguishable from luck. Its 5th-percentile max drawdown was −29%
     against −59% for the S&P 500, a robust risk reduction.

Known limitations:
- **Survivorship and selection.** The asset menu (US equities, Treasuries, gold) is chosen
  with hindsight about which assets hedged well after 2000.
- **Proxies.** Pre-inception ETF returns come from indices or mutual funds, flagged on the
  charts.
- **Execution.** Trades happen at the close; there is no intraday slippage beyond `costBps`,
  and no market impact or tax.
- **Signal history.** The full component set only exists from about 2006, so the
  out-of-sample evidence contains only a handful of crises (2008, 2011, 2015–16, 2018, 2020,
  2022).
## 10. Behaviour in stress episodes: 2008, 2018, 2020, 2022
The in-app Methodology page computes these tables live for the current parameters. The
snapshot below uses the **default (Balanced)** parameters and data through 2026-10-21.

| Episode window | S&P 500 | Strategy | Lowest score | First Crisis / Risk-Off day | Days in Crisis / Risk-Off |
|---|---|---|---|---|---|
| 2008 GFC (1 Sep 08 – 31 Mar 09) | −36.6% | −2.9% | 2.5 (23 Oct 08) | 2 Sep 08 | 100% |
| Volmageddon (26 Jan – 30 Apr 18) | −7.3% | −4.2% | 20.5 (9 Apr 18) | 9 Feb 18 | 85% |
| Covid crash (19 Feb – 30 Apr 20) | −13.6% | −1.9% | 4.4 (27 Mar 20) | 25 Feb 20 | 92% |
| 2022 rate shock (3 Jan – 31 Oct 22) | −18.2% | −19.3% | 21.0 (12 May 22) | 21 Jan 22 | 77% |

The most stressed reading of each input within the window:

| Input | 2008 | 2018 | 2020 | 2022 |
|---|---|---|---|---|
| VIX | 80.9 (20 Nov) | 37.3 (5 Feb) | 82.7 (16 Mar) | 36.5 (7 Mar) |
| VIX / VIX3M | 1.43 (24 Oct) | 1.33 (5 Feb) | 1.34 (28 Feb) | 1.02 (1 Mar) |
| VX CM30 / CM60 | 1.30 (17 Oct) | 1.15 (5 Feb) | 1.26 (16 Mar) | 1.05 (7 Mar) |
| VVIX | 135 (27 Oct) | 181 (8 Feb) | 208 (16 Mar) | 154 (24 Jan) |
| Equity P/C, 10-day average | 0.98 (21 Nov) | 0.72 (15 Feb) | 0.99 (19 Mar) | 0.79 (3 Oct) |
| VRP (VIX − 21d realised) | −35.8 (4 Nov) | −10.5 (26 Feb) | −52.3 (6 Apr) | −8.2 (27 May) |
| HY − IEF, 3-month return | −41.4% (11 Dec) | 0.0% | −33.0% (23 Mar) | −7.0% (6 Jul) |
| S&P vs 200-day average | −39.6% (20 Nov) | −0.3% (2 Apr) | −26.3% (23 Mar) | −17.1% (16 Jun) |

**What these show:**
- **2008, 2018, 2020: volatility-driven sell-offs.** The term-structure and VRP components
  hit extremes within days, and the defensive portfolio (Treasuries, gold, utilities,
  T-bills) rallied or held its value. The strategy kept losses to −2% to −4%.
- **2018: vol components lead, trend lags.** The trend filter barely registered (−0.3%),
  while VIX/VIX3M inverted on 5 Feb. This is why the composite mixes fast volatility signals
  with slower confirmation.
- **2022: right signal, wrong hedge.** The score flagged stress by 21 January, but this was
  an inflation and rate shock, so the usual hedges fell too. Over the window: IEF −16.1%,
  gold −9.8%, SHY −4.5%, utilities −3.7%, T-bills +0.7%.
  - Hedge variants helped only a little: the Conservative preset lost −16.4% and a T-bill/SHY
    Risk-Off portfolio −16.6%, against −19.3% for the default.
  - Much of the loss came from the bond leg of the Neutral 60/40 and from rallies spent in
    Risk-On.
  - The T-bill variant also *lowers* the full 2007–2026 Sharpe (0.53 vs 0.60), because
    Treasuries hedged well in 2008 and 2020.
  - Choosing the hedge after seeing 2022 would itself be overfitting.

## 11. Signal diagnostics and attribution
The **Diagnostics** tab measures the signal independently of the portfolio attached to it
(`web/src/engine/diagnostics.ts`, `attribution.ts`).

- **Conditional returns.** The regime (or 20-point score bucket) known at the close of t is
  paired with the asset's return on t + lag + 1, the first return a trade could earn. For each
  state it shows annualised return, volatility, Sharpe, share of up days, worst day, and the
  mean and tail odds (loss worse than −10%) of the forward 1-, 3- or 6-month return.
  Forward windows overlap, which is noted on the page.
- **Information coefficient.** Spearman rank correlation between the score and the next 1- or
  3-month return, on non-overlapping samples, with t-statistic.
- **Leave-one-out attribution.** The backtest is re-run without each enabled component (the
  remaining weights rescale) and with each component alone, over the same period.

Findings on 2026-10-22 data, default parameters, S&P 500, 1993–2026:

| Regime | Share of days | Ann. return | Volatility | Sharpe | P(next 3M < −10%) |
|---|---|---|---|---|---|
| Crisis | 6.4% | 24.6% | 37.2% | 0.66 | 10.4% |
| Risk-Off | 21.2% | 16.9% | 23.5% | 0.72 | 7.0% |
| Neutral | 41.1% | 10.4% | 14.8% | 0.70 | 5.5% |
| Risk-On | 29.7% | 8.4% | 12.4% | 0.68 | 3.4% |
| Strong Risk-On | 1.6% | 5.4% | 11.9% | 0.46 | 5.1% |

**The score sorts risk, not return.** Volatility after Crisis days was about 3× that after
calm days, and the odds of a 10% drawdown over the next quarter were 3× higher. But Sharpe
ratios are similar across states, and the IC against future returns is slightly negative
and insignificant (−0.06, t = −1.2, 1-month horizon). High-volatility states have
historically been followed by *higher* average returns, consistent with the literature on
volatility timing (e.g. Moreira & Muir, 2017). The strategy earns its keep by cutting
exposure when risk is high, which is why its result resembles the volatility-targeting
benchmark. It does not forecast returns.

Leave-one-out (Sharpe 0.60 with all components):
- The VRP contributes the most: Sharpe 0.51 without it.
- Removing VIX/VIX3M *raises* the Sharpe to 0.68.
- No single component alone matches the composite; the best is put/call at 0.51.

This supports combining signals, but pruning components on these figures would be another
round of fitting to the same history.

## 12. Daily signal snapshot and alerts
After the pipeline runs, the daily Action executes the same TypeScript engine in Node
(`web/scripts/signal.ts`) with the **default (Balanced)** parameters and writes:
- `data/site/latest.json`: date, score, regime, allocation and components.
- `data/site/regime_history.json`: every regime change since the score begins.
- `data/site/feed.xml`: an RSS feed of the last 30 regime changes.

If the regime differs from the previous day's `latest.json`, the Action opens a GitHub
issue labelled `regime-change` with the new regime, allocation and component table.
GitHub emails the repository's watchers.

## 13. Optimisation (allocation and signal weights)
The **Optimise** tab (`web/src/engine/optimise.ts`) searches for better regime portfolios and
component weights. Every result is shown next to an out-of-sample test, and costs are charged
in every evaluation.

### 13.1 What to hold in each regime
- **Estimates.** For each regime, the means and covariance of asset excess returns (over
  T-bills) are estimated on the days *after* the regime was signalled (label at t, return at
  t + lag + 1). Means are shrunk toward the cross-asset average (default 50%), and
  correlations toward zero (10%).
- **Objective, long-only, capped weights (default 60%):**
  - *return − γ/2 × variance* (default, γ = 3);
  - max return under a volatility cap;
  - minimum variance;
  - max Sharpe. Max Sharpe puts short Treasuries and T-bills in every regime, because those
    have the highest Sharpe ratios, so it is a poor choice for a timing allocation.
- **Thin regimes.** A regime with fewer than 250 days of history (default) keeps its
  current portfolio. Strong Risk-On has only 138 days.
- **Walk-forward.** Every year, portfolios are re-fitted on all data up to that date and
  applied to the next year.
- *Result on 2026-10-22 data (defaults, out-of-sample window 2007–2026):*

| | Sharpe | CAGR | Max drawdown |
|---|---|---|---|
| Current hand-built portfolios | 0.60 | 7.4% | −21.8% |
| Walk-forward optimised | 0.51 | 7.1% | −23.5% |
| Full-sample optimised (hindsight, not achievable) | 0.80 | 11.2% | −17.8% |

  The full-sample optimum also produces odd portfolios, such as 60% gold in Risk-On.
  Conditional mean returns are too noisy to estimate per regime, consistent with §11's
  finding that the score sorts risk rather than return.

### 13.2 Signal component weights
- **Search.** Coordinate descent over candidate weights (e.g. 0 / 0.5 / 1 / 2): up to three
  passes, keeping any change that improves the objective on the **training period only**.
- **Train / test.** Results are reported for the training period and for the untouched test
  period, against the current and equal weights.
- **Walk-forward.** From the training cut-off, the search is re-run every 1–3 years on an
  expanding window and its weights are applied to the next period only. A switching cost is
  charged at each re-fit.
- *Result on 2026-10-22 data (Sharpe objective, training to 2016-12-31):*

| | Training 2007–2016 | Test 2017–2026 |
|---|---|---|
| Current weights | 0.46 | 0.75 |
| Equal weights | 0.66 | 0.58 |
| Optimised on training | **0.95** | 0.50 |
| Walk-forward re-optimised yearly | – | 0.58 |

  The in-sample gain (+0.49 Sharpe from the best of 58 tries) reversed out of sample: textbook
  overfitting. Periodic re-optimisation also failed to beat fixed weights. Recommendation:
  keep simple, economically motivated weights, and use the optimiser to learn how fragile an
  apparent improvement is.

