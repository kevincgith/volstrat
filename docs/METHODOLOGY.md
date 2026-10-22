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
- Any intraday Yahoo bar is dropped before 16:30 ET.
- Required sources (Cboe indices, VX, Treasury, core Yahoo tickers) fail the daily job and
  open a GitHub issue. Optional ones (put/call, FRED, proxies) fall back to cached data and
  are flagged in `meta.json`.

### 2.9 Effective sample
- **Full signal set:** from mid-2006, limited by VVIX and VIX3M. After a one-year standardisation
  warm-up, the default backtest starts around mid-2007 and includes 2008.
- **Long history:** from 1990 with a reduced component set. Components without data on a given
  date are excluded and the remaining weights are rescaled to sum to 1.

## 3. Signal components *(P2/P5)*
## 4. Standardisation: rolling and expanding windows only *(P2)*
## 5. Composite score, smoothing and hysteresis *(P2)*
## 6. Allocation mapping *(P2)*
## 7. Backtest assumptions: execution lag, costs, financing, cash yield *(P2)*
## 8. Performance metrics *(P2)*
## 9. Robustness and overfitting *(P4)*
## 10. Behaviour in stress episodes: 2008, 2018, 2020, 2022 *(P5)*
