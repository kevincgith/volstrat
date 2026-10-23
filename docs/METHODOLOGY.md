# VolStrat methodology

This document is filled in phase by phase. Sections marked *(Pn)* are written in that phase.

## 1. Objective

The goal is to build a daily composite *risk-appetite score* from volatility, options-sentiment and
credit/financial-conditions indicators, and to map it to a tactical allocation between risk assets
(the S&P 500, unlevered or 2×/3× levered, and MSCI World) and defensive assets (Treasuries, T-bills,
gold, utilities). The aim is to cut drawdowns in stress regimes while keeping most of the upside in
calm ones.

> **Main caveat (§15.8).** On 2007–2026 the strategy cuts drawdowns well. On 1993–2006, an
> era never used to design it, it trailed a static 60/40 portfolio (Sharpe 0.18 against 0.51)
> and lost more than the S&P 500 in 2001. It works on sharp volatility shocks, not on slow,
> high-volatility bear markets or booms.

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
| Factor equity: low vol / min vol / quality / momentum / value / high beta | SPLV (2011-05-05) / USMV (2011-10-20) / QUAL (2013-07-18) / MTUM, VLUE (2013-04-18) / SPHB (2011-05-05) | none: a backtest holding one starts when it does |
| Treasuries 3–7y / 10–20y | IEI / TLH (2007-01-11) | none |
| TIPS | TIP (2003-12-05) | none |
| T-bills 0–3m | SGOV (2020-06-01) | 3-month T-bill accrual |
| Floating-rate Treasuries | USFR (prices used from 2018; thinly traded before, with stale and bad prints) | 3-month T-bill accrual |
| Overnight cash | none: accrual at the effective fed funds rate (FRED DFF) less 0.10% a year | — |

Joined (spliced) segments are flagged in the data and shaded on charts.

The nine original Select Sector SPDRs (XLB, XLE, XLF, XLI, XLK, XLP, XLU, XLV, XLY; all from
1998-12-22) are also downloaded, dividend-adjusted. They aren't held; they feed the absorption
ratio (§15.6). On download (2026-10-23) all nine had 7,001 days with no gaps.

### 2.5 Rates, credit and financial conditions
- **US Treasury daily par yield curve** (`home.treasury.gov` CSV, 1990 → today) is the primary
  source for the 3-month bill, 2-year, 10-year and the 10y–2y slope.
- **FRED**, via the official API using the repository secret `FRED_API_KEY` (keyless
  `fredgraph.csv` is blocked both locally and from GitHub runners). Coverage, verified
  2026-10-23:
  - Moody's Baa − 10y (`BAA10Y`): 1986 onwards, daily, 1-business-day lag.
  - NFCI: weekly, 5-day publication lag.
  - STLFSI4: weekly from 1994, 6-day lag.
  - **ICE BofA HY and IG OAS: only about 3 years** (from Oct 2023). FRED shows ICE data on a
    rolling 3-year window under its licence, which is too short to standardise or backtest.
    The HY OAS component therefore stays off; Baa − 10y is the long-history credit-spread
    component.
  - Fallback if FRED fails: HYG/LQD total return relative to IEF (credit ETF component).

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
3. **Timing.** A Cloudflare cron Worker (`worker/volstrat-refresh.js`) dispatches the run
   every hour at :20. A day is picked up within an hour of its last input being published.
   Runs that find nothing new commit nothing and don't redeploy. GitHub's own schedule (23:30 and 11:15 UTC) is kept as a best-effort fallback.
4. **Completeness gate.** Vendors publish at different times after the close. On
   2026-10-22 at 21:10 New York time, Yahoo had index bars but no ETF bars, Cboe's VIX field
   was blank, and CFE settlements were not out. So a date is published, and a live decision
   logged, only once every input of the default strategy has it:
   - Yahoo ^GSPC, SPY, SSO, IEF, AGG, GLD, XLU, BIL and HYG;
   - Cboe VIX, VIX3M, VVIX and SKEW;
   - CFE VIX futures;
   - Cboe equity put/call.

   Until then everything stays on the last complete date, and `meta.json` / the Dashboard
   list the pending inputs.
   - **VIX futures fast path.** CFE's per-contract history files update hours after
     Cboe's daily settlement file (`…/futures/market_statistics/settlement/csv?dt=`). Days
     after the last history date are filled from that file (monthly contracts, settlement
     price only). When the history file catches up, its row replaces the fast-path row, and
     the past-week reconciliation reports any difference. Verified identical for all 9
     monthlies on 2026-10-21.
   - **Alert.** If the latest end-of-day date is still incomplete at **12:00 New York time
     on the next business day**, four hours before the close its decision would trade at,
     the run opens one `data-incomplete` issue. It comments while the gap lasts and closes
     automatically once the day completes.
5. **Disclosure.** The cutoff of the last fetch is published in `meta.json` and on the
   Dashboard.
6. **Past-week reconciliation.** Every run compares the freshly downloaded values for the
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
| Absorption ratio shift | 15-day vs 1-year average of the sector-PCA absorption ratio, in σ (§15.6) | high | off | 2000-12 |

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
- **Regime mode (default):** each regime has its own editable portfolio. Defaults (the
  *Growth* profile since 2026-10-23; Balanced, the earlier defaults, in brackets):
  - Crisis: 100% T-bills (BIL)
  - Risk-Off: 50% IEF, 25% GLD, 25% XLU
  - Neutral: 80% S&P 500, 20% IEF (Balanced: 60% / 40%)
  - Risk-On: 75% S&P 500, 25% SSO, i.e. 125% equity (Balanced: 100% S&P 500)
  - Strong Risk-On: 100% SSO (2×)
  - Growth also enables the panic-rebound re-entry (§15.2); Balanced does not.
- **Continuous mode:** equity exposure moves linearly from `minEquity` at score ≤ `scoreLow`
  to `maxEquity` at score ≥ `scoreHigh` (defaults 0% at 20 and 150% at 80). Exposure up to
  100% is the S&P 500 plus the defensive mix (default 50% IEF / 25% GLD / 25% BIL). Above
  100% it is a fully invested blend of the S&P 500 and the leveraged ETF.
- **Presets:**
  - *Growth:* the defaults. 80/20 in Neutral, 125% equity in Risk-On, and the
    panic-rebound re-entry (§15.2). See §15.4.
  - *Balanced:* the defaults until 2026-10-23, with every optional feature off (live
    track record v1).
  - *Conservative:* no leverage, slower signal, 40/60 in Neutral.
  - *Aggressive:* faster signal, 2× in Risk-On and 3× in Strong Risk-On.
  - Presets other than Growth are changes to Balanced. Links and saved profiles created
    before 2026-10-23 store changes to Balanced and still open with the same settings.
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
snapshot below uses the **Balanced** parameters (the defaults until 2026-10-23) and data
through 2026-10-21.

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
(`web/scripts/signal.ts`) with the **default (Growth since 2026-10-23)** parameters and writes:
- `data/site/latest.json`: date, score, regime, allocation and components.
- `data/site/regime_history.json`: every regime change since the score begins.
- `data/site/feed.xml`: an RSS feed of the last 30 regime changes.

If the regime differs from the previous day's `latest.json`, the Action opens a GitHub
issue labelled `regime-change` with the new regime, allocation and component table.
GitHub emails the repository's watchers.

### 12.1 Live track records
The only results on the site that are not backtests. Each version has its own folder,
`data/track/vN/`:
- `params.json`: the parameters, frozen on the version's first run.
- `decisions.csv`: one row per complete trading day (score, regime, target weights, data
  cut-off, time recorded). It is appended after the close's data is complete and before the
  target trades at the next close. Rows are never edited or backfilled.
- `NOTES.md`: annotations, since rows are never edited.

Parameter fields added after a version was frozen take their *off* value from the Balanced
base (`BASE_PARAMS`), never from the current defaults, so new options cannot change a running
record. A test checks that v1 still resolves to exactly the parameters it was frozen with.

| Version | Profile | Frozen | First decision |
|---|---|---|---|
| v1 | Balanced | 2026-10-22 | 2026-10-21 close |
| v2 | Growth (§15.4) | 2026-10-23 | 2026-10-22 close |

Both versions continue side by side. Changing the defaults again would start v3.

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

## 14. VTS-style dashboard signals: definitions, validation and evaluation
Volatility Trading Strategies (VTS) publishes a daily volatility dashboard. Its metrics were
researched from VTS's own blog posts and added as components (group *VTS-style*), **all off
by default**. They were added after the default set was fixed, so enabling them is a choice to
test, not a default.

### 14.1 Definitions
Exact where VTS publishes a formula; otherwise a transparent reconstruction, labelled as such.

| Metric | Definition used | Basis |
|---|---|---|
| VX30 | w·M1 + (1−w)·M2, with w = trading days left to M1 expiry ÷ trading days in the expiry cycle (exchange holidays excluded) | VTS formula [1] |
| VX30:VIX roll yield | (VX30 − VIX) / VIX | VTS formula [1] |
| Traders VRP | 5-day linearly weighted moving average of (VX30 − 5-day S&P 500 historical vol) | VTS formula [2] |
| Adjusted M1:M2 | (adj M2 − adj M1) / adj M1; adj M1 = VX30, adj M2 = the same roll applied to M2/M3 | VTS formula [3] |
| Cash VIX Oscillator | (VIX3M + VIX6M) − (VIX9D + VIX) | Reconstructed; reproduces both published extremes exactly [4] |
| M4–M7 | (M7 − M4) / M4 | Inferred; VTS gives no formula |
| VIX9D:VIX fast / VIX:VIX6M slow crossover | the ratios themselves; "crossover" = ratio above 1 | VTS gives no formula; continuous ratio used |
| VIX − VOLI residual | VIX minus the fit from a trailing 252-day OLS of VIX on VOLI (Nations ATM SPY implied vol, Yahoo `^VOLI`, from Jun 2013) | VTS gives no formula; transparent version |
| VX30 level | VX30 | — |
| Simple VRP | VIX − 20-day historical vol | Already in the model as `vrp` (21 days) |
| M1:M2 | (M2 − M1) / M1 | Already in the model as `vx_roll` |
| VIX:VIX3M medium crossover | VIX / VIX3M | Already in the model as `vix_term` |
| VTS Volatility Barometer | proprietary composite, no published method | Not replicated; the composite score plays this role |

### 14.2 Validation against VTS's published figures
- **VX30 vs this model's interpolated CM30:** correlation 0.9996, median gap 0.07 pts.
- **Traders VRP:** negative on 12.3% of days since 2004 (VTS: its filter excluded about 13%
  of days), and on 23.9% of days in 2018 (VTS: "nearly 25%").
- **Cash VIX Oscillator:** over 2011–2019 the reconstruction peaks at **15.28 on 2012-03-16**
  and bottoms at **−43.98 on 2018-02-05**, both exactly as published. Full-sample median
  6.83 and 5th percentile −3.07, vs 6.66 and −3.58 on VTS's dashboard at a later date.

### 14.3 Evaluation
Default parameters, 2007–2026, data through 2026-10-21:

| Metric | Max correlation with a default component | Alone: Sharpe | Added at weight 1: Sharpe change | IC vs next-month S&P return |
|---|---|---|---|---|
| Cash VIX Oscillator | 0.90 (VIX/VIX3M) | 0.38 | −0.03 | −0.28 (t −3.8) |
| VX30:VIX roll yield | 0.95 (VIX/VIX3M) | 0.23 | −0.02 | −0.17 (t −2.7) |
| Traders VRP | 0.44 (VRP) | 0.19 | −0.01 | 0.00 |
| Adjusted M1:M2 | 0.97 (VX futures slope) | 0.50 | −0.04 | −0.08 |
| M4–M7 | 0.77 (VIX) | 0.28 | −0.01 | −0.05 |
| VIX9D:VIX fast | 0.66 (VIX/VIX3M) | 0.23 | +0.02 | −0.27 (t −3.7) |
| VIX:VIX6M slow | 0.96 (VIX/VIX3M) | 0.48 | −0.02 | −0.20 (t −3.0) |
| VX30 level | 0.96 (VIX) | 0.40 | +0.01 | −0.06 |
| VIX − VOLI residual | 0.59 (SKEW) | 0.09 | −0.09 | −0.02 |
| All except VX30 level, together | — | — | 0.60 → 0.47 (turnover 6.1× → 8.4×) | — |

Conclusions:
1. **Redundancy.** Five of the nine are near-duplicates (correlation ≥ 0.9) of term-structure
   or level signals already in the model. The Diagnostics tab shows the full correlation matrix.
2. **No material improvement.** No single addition changes the composite's Sharpe by more
   than noise (±0.04), and adding them all lowers it, because the term structure ends up
   over-weighted.
3. **Strong contrarian information.** The term-structure metrics have significantly
   *negative* ICs: deep inversion has preceded *higher* next-month S&P returns (the panic
   rebound). That is the §11 finding (the score sorts risk, not return) in sharper form. As
   de-risking signals they reduce drawdowns but miss rebounds. A contrarian re-entry rule at
   extreme inversion is a promising research lead (each component's ⇅ toggle inverts it). It
   is not adopted, because choosing it after seeing these statistics would be fitting.

Sources (definitions only; no performance claims from them are used):
[1] VTS, "Volatility Metric: VX30:VIX roll yield – Constant maturity VIX contract",
volatilitytradingstrategies.com/blog/vts-volatility-dashboard-part-6-vx30-vix-adjusted-roll-yield ·
[2] VTS, "Volatility Metric: VTS Traders VRP",
volatilitytradingstrategies.com/blog/traders-vrp-a-more-robust-volatility-risk-premium-metric ·
[3] VTS, "Volatility Metric: VTS Adjusted M1:M2 VIX Futures",
volatilitytradingstrategies.com/blog/vix-futures-and-expiration-cycles-we-need-to-adjust-m1-m2-contango ·
[4] VTS, "Volatility Metric: VTS Cash VIX Oscillator",
volatilitytradingstrategies.com/blog/vts-cash-vix-oscillator-volatility-dashboard-metric

### 14.4 FRED macro-credit components (now available)
With the API key in place, three FRED components have full history. All are off by default
under the same rule. Effect of adding each to the default composite at weight 1 (2007–2026,
data through 2026-10-21):

| Component | Sharpe change | Max drawdown change | Alone: Sharpe / max drawdown |
|---|---|---|---|
| Credit: Baa − 10y 3-month change | +0.05 | −2.3 pp | 0.60 / −49.8% |
| Chicago Fed NFCI | +0.06 | −0.8 pp | 0.67 / −34.1% |
| St. Louis Fed Financial Stress Index | +0.08 | +0.2 pp | 0.48 / −31.0% |

These are the largest improvements among all the added signals. That is plausible: funding
and credit conditions carry information that options-implied volatility does not. NFCI and
STLFSI were in the original specification but not in the default set (slow, weekly,
published with a lag). The gains are in-sample and modest. Before enabling one, check the
Optimise tab's train/test split and the bootstrap confidence on the Backtest page.

## 15. Out-of-sample checks of candidate improvements
Every candidate is judged on 2017–2026 after being motivated or specified on 2007–2016,
with a paired bootstrap on the test years (1,000 resamples, 21-day blocks). Data through
2026-10-21.

### 15.1 FRED macro-credit components: rejected
| Added to default | Sharpe 2007–2016 | Sharpe 2017–2026 | Test-period bootstrap |
|---|---|---|---|
| none (base) | 0.46 | 0.75 | — |
| Baa − 10y change | 0.67 | 0.63 | worse in 96% of resamples |
| NFCI | 0.65 | 0.68 | worse in 80% |
| STLFSI | 0.66 | 0.71 | worse in 70% |
| all three | 0.69 | 0.67 | worse in 78% |

The in-sample gain (§14.4) came almost entirely from the 2008 credit crisis, and all three
hurt after 2016. Defaults are unchanged.

### 15.2 Panic-rebound override: passed, kept optional
- **Hypothesis**, from §11 and §14.3: deep inversions of the VIX term structure precede
  higher returns, so a strategy that de-risks in panics misses the rebound.
- **Rule**, specified once on 2026-10-23 and not tuned. If VIX/VIX3M rose above **1.10**
  within the last **20** trading days and is now back below **1.00**, Crisis or Risk-Off is
  lifted to **Neutral** for **20** trading days. A new inversion above 1.10 cancels it. The
  rule uses only the ratio up to day t, and the look-ahead suite covers it.

| Period | Sharpe | CAGR | Max drawdown | Override days |
|---|---|---|---|---|
| 2007–2016, base → rebound | 0.46 → 0.51 | 5.1% → 5.8% | −20.1% → −15.2% | 186 |
| 2017–2026, base → rebound | 0.75 → 0.85 | 9.8% → 10.9% | −21.8% → −21.8% | 133 |
| Full, base → rebound | 0.60 → 0.67 | 7.4% → 8.3% | unchanged | 319 |

- **Test-period bootstrap:** Sharpe difference +0.09, 5th–95th percentile −0.02 to +0.21,
  better in 92% of resamples.
- **Triggers:** 20 in 20 years (e.g. Dec 2008, Aug 2011, Sep 2015, Feb 2018, Jan 2019,
  Apr 2020, Aug 2024, Apr 2025).
- **Verdict:** the first change to improve both halves and to beat fixed parameters out of
  sample. Caveats: the hypothesis came from full-sample statistics (only the rule's settings
  were fixed blind), 92% is below the conventional 95% bar, and 20 events is a small sample.
  It stayed **off by default** at first; it became part of the default Growth profile with
  §15.4 on 2026-10-23. The live track record v1
  keeps the original rules; adopting the override would start a v2 record.

### 15.3 Composite re-ranking and a one-sided VRP: rejected
- **Motivation (2026-10-23).** The variance risk premium dominated the composite: it ranked
  at the 91st percentile while the other components sat at 14–54. That raised two questions:
  1. Should the composite be standardised again? Averaging ranks pulls it toward 50, so the
     regime cut-offs aren't frequencies.
  2. Should the VRP count only on the stress side?
- **Settings fixed before testing.**
  - (A) Re-rank the composite within the components' trailing window (756 days, at least
    252 of history) before smoothing.
  - (B) Cap the VRP's oriented score at 50.

| Variant | Sharpe 2007–2016 | Sharpe 2017–2026 | Turnover | Test bootstrap | Regime shares (Crisis…Strong) |
|---|---|---|---|---|---|
| Current method | 0.46 | 0.75 | 6.1× | — | 8 / 21 / 37 / 33 / 2 % |
| A re-rank | 0.39 | 0.52 | 13.2× | worse in 94% | 21 / 20 / 21 / 21 / 18 % |
| B one-sided VRP | 0.61 | 0.44 | 6.9× | worse in 100% | 9 / 23 / 38 / 30 / 0 % |
| A + B | 0.43 | 0.57 | 14.5× | worse in 86% | 21 / 21 / 20 / 20 / 18 % |

**Conclusions.**
- **Re-ranking doubles turnover without better timing.** It spreads time evenly across the
  regimes, including the leveraged and all-cash extremes.
- **The VRP's calm-side information is real.** Cutting it helped in 2007–2016 but cost 0.31
  Sharpe in 2017–2026. A rich premium with low realised volatility has preceded good equity
  returns, and that is what the composite rewards.
- **This is the textbook case for the held-out test:** judged on the first half alone, (B)
  would have been adopted.
- Both remain available as options (Backtest panel: *Re-rank the composite*; the ½ button
  per component) and are off by default.

### 15.4 Does avoiding drawdowns improve long-term returns?
Question (2026-10-23): the strategy's premise is that avoiding drawdowns compounds into better
long-term performance, yet its CAGR trails the S&P 500 (7.4% vs 10.9%, 2007–2026).

**Diagnosis.** The drawdown control works: the worst drawdown is −21.8% against −55.2% for the
S&P 500 and −35.4% for 60/40. The return gap has three sources:

| Measurement | Result |
|---|---|
| Average equity exposure | 59% (Neutral, 60/40, holds 37% of days) |
| Static mix with the same 59% exposure, rebalanced monthly | CAGR 8.6%, Sharpe 0.63, max drawdown −34.4% (strategy: 7.4%, 0.60, −21.8%) |
| Annualised return with the S&P 500 within 5% of its high | strategy 6.8%, S&P 9.4% |
| … more than 15% below its high (the rebound phase) | strategy 8.6%, S&P 21.7% |
| Strategy scaled to the S&P 500's volatility (1.95×) | CAGR 11.3% vs 10.9%; test half 14.8% vs 15.1% |

1. **Missed rebounds.** After each low the composite stays low for about 40 trading days.
   Realised volatility keeps the VRP negative, and the VIX level and trend are slow to
   recover. Across nine sell-offs since 2007, the strategy captured a median of about a third
   of the S&P 500's rebound from the low (COVID: +7.5% vs +52.6%; Q4 2018: +4.7% vs +25.5%).
2. **Low exposure in calm markets.** Never above 100% except in Strong Risk-On (2% of days).
3. **At equal risk the timing adds almost nothing.** The lower drawdowns come mostly from
   holding less equity, not from timing. Avoiding a −55% loss only compounds into a higher
   return if the saved risk is spent somewhere.

The Backtest page's **Equal-risk check** card now shows this comparison for every run.

**Candidates, fixed before testing; train 2007–2016, test 2017–2026.**
- (A) The panic-rebound re-entry of §15.2, unchanged.
- (B) Spend the drawdown savings: Neutral 80% S&P 500 / 20% IEF; Risk-On 75% S&P 500 /
  25% SSO (125% equity). Crisis, Risk-Off and Strong Risk-On are unchanged.
- (A + B), and (A + B) with the adaptive hedge of §6.1.

| Variant | Train CAGR / Sharpe / max DD | Test CAGR / Sharpe / max DD | Full CAGR / max DD | Equity exposure | Test Sharpe vs base: P(better) |
|---|---|---|---|---|---|
| S&P 500 | 7.0% / 0.39 / −55.2% | 15.0% / 0.72 / −33.7% | 10.9% / −55.2% | 100% | — |
| 60/40 | 6.3% / 0.50 / −35.4% | 9.8% / 0.66 / −21.5% | 8.0% / −35.4% | 60% | — |
| Base | 5.1% / 0.46 / −20.1% | 9.7% / 0.75 / −21.8% | 7.4% / −21.8% | 59% | — |
| A rebound | 5.8% / 0.51 / −15.2% | 10.9% / 0.84 / −21.8% | 8.3% / −21.8% | 62% | 92% |
| B exposure | 6.0% / 0.47 / −22.5% | 11.2% / 0.75 / −23.8% | 8.6% / −23.8% | 74% | 53% |
| **A + B (Growth preset)** | 6.6% / 0.50 / −19.7% | 12.9% / 0.85 / −23.8% | 9.7% / −23.8% | 79% | 88% |
| A + B + hedge | 6.7% / 0.50 / −20.1% | 12.8% / 0.86 / −21.9% | 9.7% / −21.9% | 79% | 86% |

Scaled to the S&P 500's volatility with the same method as the card, the rebound variant earns
12.8% a year against 10.9% (train 8.9% vs 7.0%, test 16.9% vs 15.1%), with a worst drawdown of
−39.0% against −55.2%.

**Conclusions.**
- **(B) is a risk dial, not an edge.** It raises return and drawdown together and leaves the
  Sharpe ratio unchanged. It is how drawdown savings turn into return.
- **(A) is the only change that adds timing skill**, and it repairs the documented weakness:
  missed rebounds. Its caveats are in §15.2.
- **(A + B) beats 60/40 in both halves** with a smaller drawdown (full: 9.7% vs 8.0% CAGR,
  −23.8% vs −35.4%). It still trails the S&P 500's CAGR (9.7% vs 10.9%) at roughly half the
  drawdown. Beating the index's CAGR outright takes about 1.9× the base risk, with
  drawdowns near −39%.
- The adaptive hedge adds little and was prompted by 2022 (hindsight), so it is not in the
  preset.
- **Adopted as the default on 2026-10-23**, with live track record v2 (§12.1). The v1 record
  continues with the Balanced parameters, so the two run side by side out of sample.


### 15.5 Re-entry rules after a sell-off
**Question (2026-10-23).** §15.4 found that most of the return gap comes from missed
rebounds. Is there a sound, more general way to re-enter than the panic-rebound rule?

**Rationale for a broader rule.**
- After a volatility shock, implied volatility mean-reverts, and returns are highest when
  fear is high but falling (§14.3).
- Volatility also eases during bear-market rallies. A price condition guards against buying
  those.

**Test 1: recovery re-entry, fixed before testing.**
- **Applies:** only in Crisis or Risk-Off.
- **Enter** (lift to Neutral) when all three hold:
  1. VIX is at most 0.80× its 20-day high;
  2. VIX/VIX3M is below 1.00;
  3. the S&P 500 is above its 20-day moving average.
- **Exit** when VIX/VIX3M returns to 1.00 or above, or the S&P 500 closes below its lowest
  close of the previous 20 days.
- **Adoption bar:**
  - test-half Sharpe above Growth's in at least 90% of paired bootstrap resamples;
  - training-half Sharpe not lower than Growth's;
  - full-period max drawdown no more than 3 points worse.

**Test 2: "rebound, held", specified after test 1 and reported as a second look.**
- Same trigger as the panic-rebound rule.
- Instead of a fixed 20 days, the lift lasts until VIX/VIX3M is back at 1.00, the S&P 500
  breaks its 20-day low, or the signalled regime itself reaches Neutral.

All variants are on top of Growth.

| Variant | Train CAGR / Sharpe / max DD | Test CAGR / Sharpe / max DD | Full max DD | Turnover | Test Sharpe: P(better than Growth) |
|---|---|---|---|---|---|
| Growth (panic rebound, 20-day hold) | 6.6% / 0.50 / −19.7% | 12.9% / 0.85 / −23.8% | −23.8% | 6.6× | — |
| Recovery re-entry instead | 4.9% / 0.37 / −31.8% | 12.9% / 0.84 / −26.8% | −31.8% | 8.4× | 46% |
| Both | 6.7% / 0.49 / −25.9% | 13.4% / 0.87 / −26.8% | −26.8% | 7.7× | 54% |
| *Ablation: recovery re-entry without the price condition* | 4.2% / 0.32 / −35.3% | 12.9% / 0.85 / −23.8% | −35.3% | 9.7× | 46% |
| Rebound, held (test 2) | 6.7% / 0.52 / −20.4% | 13.1% / 0.88 / −23.8% | −23.8% | 7.0× | 61% (train: 65%) |
| Growth without any re-entry | 6.0% / 0.47 / −22.5% | 11.2% / 0.75 / −23.8% | −23.8% | 6.0× | 9% |

**Conclusions.**
- **Re-entering after ordinary stress does not pay.**
  - The broad rule fired 70 times in 20 years, against 19 for the panic trigger, and many
    entries were 2008 bear-market rallies.
  - The price condition helped (Sharpe 2007–2016: 0.32 → 0.37) but not enough.
- **Re-entering after capitulation does pay.**
  - Removing the panic rule costs 0.10 test Sharpe (re-entry is worth it in 91% of
    resamples).
  - Both tests say the same thing: buy back after the VIX curve has inverted deeply and then
    normalised, not merely after volatility eases.
- **Holding the rebound until the signal recovers is slightly better** in both halves, but
  only in 61–65% of resamples, below the bar. Specified after test 1, it would need a stronger
  result than that.
- **A gap remains.** The rule lifts to Neutral (80/20), so it still captures only part of a
  V-shaped recovery (COVID: +11% vs +53% for the S&P 500 in the six months after the low).
  Lifting further raises the cost of false triggers. With 19 triggers in 20 years, the data
  can't settle that reliably.
- **Decision:** Growth is unchanged. Both rules are options in the Backtest panel: *Recovery
  re-entry (broad)*, and *Ends: on re-inversion or breakdown* in the panic-rebound box. Both
  are off by default.

### 15.6 Absorption ratio (sector PCA): rejected
**Idea.** Kritzman, Li, Page and Rigobon, *Principal Components as a Measure of Systemic Risk*
(2010/11). When a few common factors explain most of the movement across a market's parts,
the market is tightly coupled, and shocks spread. They reported that sharp rises in this
*absorption ratio* came before large drawdowns.

**Definition, fixed before computing it (2026-10-23).**
- **Universe:** the 9 original Select Sector SPDRs, dividend-adjusted daily log returns.
- **Absorption ratio** at close t: the exponentially weighted covariance of the last 252
  returns (half-life 126 days); the ratio is the share of its total variance in the top 2
  eigenvalues.
  - 2 of 9 follows the paper's rule of about a fifth of the assets.
  - Pipeline: `build/absorption.py`; signal `AR2_9`.
- **Component** (the paper's standardised shift): 15-day mean minus 252-day mean, divided by
  the 252-day standard deviation. High = risk-off.
- **Test:** the same bar as §15.4–15.5: Growth plus the component at weight 1, train
  2007–2016, test 2017–2026. The AR level as a component was reported as a secondary result,
  not as a candidate.

**Data.** The ratio ranges from 0.58 (Dec 2017) to 0.948 (24 Mar 2020); median 0.80. Today
it is low, 0.60 (2026-10-22): sectors are moving unusually independently.

| | Train Sharpe / max DD | Test Sharpe / max DD | Full CAGR / max DD | P(better than Growth), test / train |
|---|---|---|---|---|
| Growth | 0.50 / −19.7% | 0.85 / −23.8% | 9.7% / −23.8% | — |
| **+ absorption shift (candidate)** | **0.64** / −16.8% | **0.71** / −26.9% | 9.8% / −26.9% | **1%** / 94% |
| + AR level (secondary) | 0.54 / −19.0% | 0.83 / −22.9% | 9.9% / −22.9% | 44% / 66% |

- **On its own:** Sharpe 0.40 (train 0.10, test 0.78).
- **Information coefficient:** the oriented score against next-month S&P 500 returns is −0.07
  (t −1.0), i.e. no forecasting power.
- **Overlap with existing components:** correlation 0.53 with trend, 0.42 with the VIX level
  and 0.40 with credit.

**Why it failed.** The shift peaked *after* most lows:
- 31 Oct 2008, after Lehman;
- 31 Dec 2018, a week after the low;
- 27 Mar 2020, after the low;
- 5 Mar 2018, after Volmageddon.

Correlation is measured from realised returns over a long window, so it confirms a sell-off
rather than anticipating it. As a risk-off input it therefore delays re-entry: the weakness
found in §15.4.

Its one early warning was 23 Aug 2007 (+2.09σ, before the Oct 2007 top). That warning is the
paper's headline example, and it is why the first half looked good.

**Decision.** Rejected. Judged on 2007–2016 alone, it would have been adopted. It remains
available as *Absorption ratio shift (sector PCA)* in the new **Correlation** group, off by
default. The defaults and the live records are unchanged.

### 15.7 Factor ETFs, bond duration and cash as holdings
**Settings fixed before testing (2026-10-23).** Each variant changes one part of Growth's
portfolios. The adoption bar is the same as §15.4–15.6.

**Factor ETFs.** Window 2013-07-22 to today, with halves split at 2020. Every variant,
Growth included, starts on the same day.

| Variant | 2013–2019 Sharpe / max DD | 2020– Sharpe / max DD | Full CAGR / max DD | P(better than Growth): 1st / 2nd / full |
|---|---|---|---|---|
| Growth | 0.79 / −11.5% | 0.70 / −23.8% | 10.0% / −23.8% | — |
| Risk-Off: utilities → min-vol (USMV) | 0.82 / −10.5% | 0.67 / −23.8% | 9.8% / −23.8% | 72% / 22% / 40% |
| Neutral: S&P 500 → min-vol (USMV 80 / IEF 20) | 0.98 / −8.4% | 0.60 / −19.8% | 9.5% / −19.8% | 95% / 23% / 53% |
| Risk-On: S&P 500 → quality (QUAL 75 / SSO 25) | 0.71 / −13.1% | 0.65 / −24.0% | 9.3% / −24.0% | 6% / 16% / 5% |

- Min-vol in Neutral was the strongest idea in 2013–2019 and lagged after 2020. That is the
  same first-half/second-half reversal seen in §15.3 and §15.6.
- **None adopted.**

**Bond duration.** The IEF sleeve (50% of Risk-Off, 20% of Neutral) was replaced with each
alternative. Train 2007–2016, test 2017–2026.

| Sleeve | Train Sharpe | Test Sharpe | Max DD | 2022 window | GFC | P(better): train / test |
|---|---|---|---|---|---|---|
| IEF 7–10y (Growth) | 0.49 | 0.85 | −23.8% | −22.3% | −17.9% | — |
| SHY 1–3y | 0.44 | 0.90 | −21.2% | −19.0% | −18.9% | 6% / 86% |
| IEI 3–7y | 0.46 | 0.88 | −21.8% | −20.8% | −18.3% | 9% / 87% |
| TLH 10–20y | 0.49 | 0.78 | −27.8% | −25.8% | −18.1% | 64% / 1% |
| TIP | 0.48 | 0.87 | −22.3% | −21.6% | −19.4% | 35% / 76% |

- Shorter duration helped in the rising-rate decade and hurt in the falling-rate one. Longer
  duration did the opposite. No single duration was better in both, so IEF stays.
- TIPS were in between and did not fix 2022: −21.6% against −22.3%.

**Cash.** BIL, SGOV, USFR and overnight cash in Crisis give the same results to one decimal
place (Growth CAGR 9.61% with BIL, 9.63% with overnight cash). The choice is a matter of
implementation: fee and liquidity.
- Overnight cash accrues the effective fed funds rate less 0.10% a year. It earned 1.51% a
  year from mid-2007 against 1.40% for BIL, and 5.14% against 4.99% in 2023.
- It is a synthetic series: no ETF tracks the overnight rate over this history.

All of these remain available in the portfolio editors.

### 15.8 An independent era: 1993–2006
**Purpose.** Every rule so far was designed and tested on 2007–2026, which has about seven
real sell-offs. The years 1993–2006 were never used for any choice. Settings fixed before
running:
- **A:** Growth exactly, 2000-09 to 2006, since gold history starts in 2000-08.
- **B:** Growth and Balanced from 1993 to 2006, with gold removed from Risk-Off (IEF 75% /
  XLU 25%).
- Only some components exist before 2006: VIX, SKEW, VRP, credit and trend; put/call from
  2003-10 and the VX slope from 2004-03. They renormalise as usual. VIX/VIX3M begins in 2006,
  so the panic-rebound rule is inactive.

| 1993–2006 (B) | CAGR | Sharpe | Max drawdown |
|---|---|---|---|
| Growth | 5.6% | 0.18 | −50.1% |
| Balanced | 5.2% | 0.16 | −39.6% |
| Static mix with Growth's average 72% equity | 9.8% | 0.49 | −34.1% |
| S&P 500 | 10.7% | 0.45 | −47.5% |
| 60/40 | 9.1% | 0.51 | −25.7% |
| Vol target 12% | 8.5% | 0.41 | −37.4% |

| 2000-09 to 2006 (A) | CAGR | Sharpe | Max drawdown |
|---|---|---|---|
| Growth | −2.7% | −0.36 | −47.2% |
| Balanced | −1.7% | −0.37 | −37.6% |
| S&P 500 | 0.5% | −0.04 | −47.3% |
| 60/40 | 2.7% | 0.04 | −25.7% |

**This is not a data problem.**
- Asset returns match published history: S&P 500 −11.9% in 2001 and −22.1% in 2002;
  utilities −29% in 2002; gold +24% in 2002.
- Run on 2007–2026, the reduced set of components does as well as the full model: Sharpe
  0.68 against 0.66, max drawdown −24.5% against −23.8%.
- So the failure belongs to the era, not to the missing components.

**How it fails (Growth, 1993–2006, by year):**
- **High-volatility bull markets.** In 1996–1999, VIX rose (averaging 22–26 in 1997–1999)
  while stocks boomed. The volatility percentiles read stress, and the strategy held 43–73%
  equity:

  | | 1997 | 1998 | 1999 |
  |---|---|---|---|
  | Strategy | +15.0% | +20.4% | +7.2% |
  | S&P 500 | +33.5% | +28.7% | +20.4% |

- **Slow, choppy bear markets.**
  - 2000–2002 was a valuation bust with persistently high volatility, not a single shock.
  - Measured against a three-year window that was itself volatile, a VIX of 20–23 looked
    calm. The score kept returning to Neutral or Risk-On during declines: Jan–May 2002,
    Dec 2002–Mar 2003.
  - The strategy re-entered failed rallies, sometimes with 2× leverage, and its utilities
    sleeve fell 29% in 2002.
  - In 2001 it lost 20.6% against 11.8% for the S&P 500, while averaging only 37% equity.

**Conclusion.** The edge measured on 2007–2026 is specific to that era: sharp volatility
shocks followed by V-shaped recoveries (2008, 2011, 2015, 2018, 2020). The composite is a
detector of volatility shocks. It does not recognise a bear market made of high-volatility
grinding declines, and it under-invests in a high-volatility boom.

The live records and the defaults are unchanged. This section is the most important caveat
in this document: the backtest from 2007 overstates how reliably the strategy beats a static
60/40 portfolio.

Changing the rules now to fix 1993–2006 would use up the last untouched data. Any such fix
would need to be judged on the live record.


## 16. v3: a redesign to beat 60/40, tested on Europe
The redesign and the definition of "proven" were fixed in
[`docs/PREREG-v3.md`](PREREG-v3.md) on 2026-10-23, before any v3 code or European result.
- **Design:** a 40–80% equity tilt around 60/40, driven by three pillars (volatility stress
  with long-anchored ranks, trend, and volatility scaling).
- **Design check:** United States 1993–2026.
- **Holdout:** Europe 2000–2026, run once.

Results will be recorded here, including failures.

### 16.1 Build and data checks (2026-10-23)
- **Engine:** `web/src/engine/v3.ts`. Covered by tests: unit checks, the 40–80% bounds, trend
  saturation, and a no-look-ahead test (changing all inputs after day T leaves the signals,
  targets and NAV up to T unchanged). Evaluation script: `npm run v3 -- us`.
- **European data:** `pipeline/volstrat_pipeline/europe.py`, writing `data/europe/europe.json`
  and `data/europe/checks.json`. Only data checks were run. What they found and what was done:
  - **STOXX file writes 0.00 on market holidays** (Good Friday and Easter Monday 2016).
    Those rows are dropped.
  - **Yahoo's Euro Stoxx 50 repeats a stale close** of 2631.98 on 14, 19 and 21 July 2011.
    The STOXX file is used until 2016-10-04, so this doesn't affect the data. After 2016 the
    Yahoo series shows no repeated closes, and no day where its return differs from the
    DAX's by more than 3%.
  - **The VSTOXX 3-month sub-index has short gaps** (six in 2005, Easter 2014) and ends
    2016-02-12. P1 averages the components that are available.
  - **VSTOXX is missing on 34 calendar days**, all half-days and holidays (24 and 31 Dec,
    1 May).
  - **EONIA vs €STR + 8.5 bp:** identical over the 579 overlapping days.
  - **AAA 10y vs German 10y:** the ECB AAA curve averages 0.20 points above the German 10y
    yield (up to 1.02 in the 2011–12 crisis). Only the 7y spot rate is used, from 2004-09.
  - **Returns match published history:** Euro Stoxx 50 with estimated dividends 5.05% a
    year, DAX 5.74%, 7y bond 2.35% (2022: −16.9%; 2008: +10.6%), cash 1.53%.
  - **Bonds before 2004-09** are spread evenly from monthly data. Their daily volatility is
    understated (0.055% vs 0.28%), as declared in the pre-registration.
  - **Certificate workaround:** STOXX's certificate chains to a root Python's bundle no
    longer carries, so its files are fetched with the system `curl`. Verification stays on.

### 16.2 US design check (run once, 2026-10-23, frozen parameters, no revision round)

| Period | v3 CAGR / vol / Sharpe / max DD | 60/40 CAGR / vol / Sharpe / max DD | Sharpe difference |
|---|---|---|---|
| 1993–2006 | 9.3% / 9.6% / 0.56 / −20.3% | 9.2% / 10.2% / 0.52 / −24.0% | +0.04 |
| 2007–2026 | 8.3% / 10.0% / 0.68 / −23.3% | 8.2% / 11.0% / 0.63 / −32.2% | +0.06 |
| 1993–2026 | 8.7% / 9.8% / 0.64 / −23.3% | 8.6% / 10.7% / 0.58 / −32.2% | +0.05 |

- **Paired bootstrap, 1993–2026:** Sharpe difference median +0.048 (5th–95th percentile
  −0.001 to +0.099); v3 is better in 95% of resamples.
- **Trading:** turnover 0.6× a year; costs 0.06% a year.
- **Criteria:** A pass, B pass, C pass.

**Reading.**
- **The edge is modest but consistent.** About +0.05 Sharpe and +0.1% a year of return, and
  most of it is risk reduction: a lower worst drawdown (−23% vs −32%) and about 1 point less
  volatility. The biggest years: 2002 (−3.7% vs −8.2%) and 2008 (−10.8% vs −17.7%).
- **v3 did not help in 2022** (−17.0% vs −16.6%). Stocks and bonds fell together, and a
  stock/bond tilt can't avoid that.
- **This is not out of sample.** The design was written by someone who knew US history (for
  example, that trend was bearish in 2000–2002). Passing A–C is necessary, not sufficient.
  The European run (D–F) is the real test.

### 16.3 European holdout (run once, 2026-10-23): not supported
Frozen v3 parameters, run once with `npm run v3 -- europe`. The raw output is saved in
`data/europe/holdout-2026-10-23.txt`. The DAX check, as read from the pre-registration,
keeps the signals unchanged (VSTOXX, Euro Stoxx 50) and replaces the equity held, in both
the strategy and the benchmark.

| Period (Euro Stoxx 50) | v3 CAGR / vol / Sharpe / max DD | 60/40 CAGR / vol / Sharpe / max DD | Sharpe difference |
|---|---|---|---|
| **2000–2026** | 3.8% / 11.9% / 0.25 / −34.5% | 4.0% / 12.8% / 0.25 / −38.7% | **−0.00** |
| 2000–2006 | 4.2% / 12.5% / 0.15 / −34.5% | 3.4% / 13.9% / 0.09 / −38.7% | +0.06 |
| 2007–2026 | 3.7% / 11.7% / 0.29 / −30.6% | 4.2% / 12.4% / 0.31 / −36.7% | −0.03 |
| DAX check, 2000–2026 | 4.6% / 12.1% / 0.31 / −41.8% | 4.6% / 13.0% / 0.30 / −47.4% | +0.01 |

- **Paired bootstrap:** Euro Stoxx 50, v3 better in **44%** of resamples (median difference
  −0.005); DAX, 63%.
- **Criteria:**
  - D **fails**: no Sharpe advantage.
  - E passes: the worst drawdown is 4 points shallower.
  - F passes: the DAX check reaches the same verdict as D.
- **Verdict: not supported** (§4 of the pre-registration). The defaults are unchanged and no
  v3 live record starts.

**What it shows.**
- **In Europe, v3 is a mild de-risker with no edge.** It had lower volatility (−0.9 points)
  and shallower drawdowns (2002: −15.7% vs −19.6%; 2008: −20.1% vs −24.4%). It paid for
  them in recoveries and choppy years: 2010, 2014–2016, 2020 (−3.2% vs +0.9%) and 2022.
  The net Sharpe difference is zero.
- **The US result now looks like the same pattern.** The +0.05 Sharpe there was mostly
  lower risk, and it doesn't carry over to another market.
- **Across all the evidence:** US 1993–2006 and 2007–2026, and Europe 2000–2026. Timing
  equity exposure with volatility, trend and volatility-scaling signals reliably reduces
  drawdowns, but has not reliably improved risk-adjusted returns over a static balanced
  portfolio.
- **Commitment (pre-registration §6).** This is the answer for v3. It is not the start of
  another search on the same data. Any new design needs data it hasn't seen: the live
  record, or a market not yet used.
