/**
 * Signal component registry.
 *
 * Each component turns raw market series into one feature per day. The score
 * engine then standardises the feature (rolling percentile or z-score) and
 * orients it so that 100 = risk-on and 0 = risk-off.
 */

import type { MarketData } from './data';
import { diff, realisedVol, rollingMeanStd, rollingResidual, sma, wma, zip2 } from './stats';

export type ComponentGroup = 'Volatility' | 'Term structure' | 'Sentiment' | 'Credit' | 'Macro' | 'Trend' | 'Correlation' | 'VTS-style';

export interface ComponentDef {
  id: string;
  label: string;
  group: ComponentGroup;
  /** Signal keys (signals.json) or `asset:KEY` the feature depends on. */
  inputs: string[];
  /** True when a HIGH raw value signals stress (risk-off). */
  riskOffWhenHigh: boolean;
  defaultWeight: number;
  defaultEnabled: boolean;
  unit: string;
  compute: (d: MarketData) => Float64Array;
  doc: {
    what: string;
    why: string;
    range: string;
    episodes: string;
  };
}

const nan = (n: number) => new Float64Array(n).fill(NaN);
const s = (d: MarketData, k: string) => d.series[k] ?? nan(d.dates.length);
const ratio = (a: Float64Array, b: Float64Array) => zip2(a, b, (x, y) => (y > 0 ? x / y : NaN));

export const COMPONENTS: ComponentDef[] = [
  {
    id: 'vix',
    label: 'VIX level',
    group: 'Volatility',
    inputs: ['VIX'],
    riskOffWhenHigh: true,
    defaultWeight: 1,
    defaultEnabled: true,
    unit: 'vol pts',
    compute: (d) => s(d, 'VIX'),
    doc: {
      what: 'The market’s 30-day implied volatility for the S&P 500, derived from SPX option prices.',
      why: 'It is the price of portfolio insurance. A high VIX means investors pay up for protection and expect large moves; volatility clusters, so high-vol regimes tend to persist and carry worse risk-adjusted equity returns.',
      range: 'Calm 11–15; normal 15–20; stressed 25–35; crisis 40+ (record close 82.69 on 16 Mar 2020).',
      episodes: '2008: from 20.7 (end Aug) to a close of 80.86 on 20 Nov. Feb 2018 (Volmageddon): 17.3 to 37.3 in one trading day (2→5 Feb). 2020: 82.69 on 16 Mar. 2022: mostly 20–33, peak 36.5 (7 Mar), a grinding bear market without a panic spike.',
    },
  },
  {
    id: 'vix_term',
    label: 'VIX / VIX3M (term structure)',
    group: 'Term structure',
    inputs: ['VIX', 'VIX3M'],
    riskOffWhenHigh: true,
    defaultWeight: 1,
    defaultEnabled: true,
    unit: 'ratio',
    compute: (d) => ratio(s(d, 'VIX'), s(d, 'VIX3M')),
    doc: {
      what: 'Ratio of 30-day to 3-month implied volatility.',
      why: 'Normally the curve slopes upward (ratio < 1, "contango"): near-term risk is priced below longer-term uncertainty. When the ratio goes above 1 ("inversion" or "backwardation"), investors are paying more for immediate protection, which is a hallmark of acute stress.',
      range: 'Typical 0.81–0.99 (10th–90th percentile since 2010); above 1.0 = inverted (stress); above 1.2 = panic.',
      episodes: '2008: inverted on 81% of days in Sep–Dec, peak 1.43 (24 Oct). Feb 2018: 1.33 (5 Feb). 2020: 1.34 (28 Feb). 2022: inverted on only 6% of days (max 1.02), consistent with an orderly sell-off.',
    },
  },
  {
    id: 'vx_slope',
    label: 'VIX futures slope (CM30 / CM60)',
    group: 'Term structure',
    inputs: ['VX_CM30', 'VX_CM60'],
    riskOffWhenHigh: true,
    defaultWeight: 1,
    defaultEnabled: true,
    unit: 'ratio',
    compute: (d) => ratio(s(d, 'VX_CM30'), s(d, 'VX_CM60')),
    doc: {
      what: 'Ratio of 30-day to 60-day constant-maturity VIX futures prices, interpolated from listed contracts.',
      why: 'The same idea as VIX/VIX3M, but measured on traded futures. Constant-maturity interpolation removes the saw-tooth jumps that VX1/VX2 shows at each monthly roll. Backwardation (ratio > 1) means hedgers are bidding up near-dated volatility.',
      range: 'Median 0.95; 10th–90th percentile 0.91–1.02 since 2004; above 1.0 = backwardation.',
      episodes: 'Backwardated on 89% of days in Sep–Dec 2008, and in the Feb 2018 and Mar 2020 shocks; on about a quarter of days in 2022.',
    },
  },
  {
    id: 'vx_roll',
    label: 'VX1 / VX2 (front futures spread)',
    group: 'Term structure',
    inputs: ['VX1', 'VX2'],
    riskOffWhenHigh: true,
    defaultWeight: 0,
    defaultEnabled: false,
    unit: 'ratio',
    compute: (d) => ratio(s(d, 'VX1'), s(d, 'VX2')),
    doc: {
      what: 'Ratio of the front-month to the second-month VIX future.',
      why: 'The classic contango/backwardation measure that VIX ETP roll yield is based on. It is noisier than the constant-maturity slope because the maturities shrink through each month and reset at expiry.',
      range: 'Median 0.94; 10th–90th percentile 0.88–1.02 since 2004; above 1.0 = backwardation.',
      episodes: 'Moves with the CM slope but jumps at contract rolls.',
    },
  },
  {
    id: 'vvix',
    label: 'VVIX (vol of vol)',
    group: 'Volatility',
    inputs: ['VVIX'],
    riskOffWhenHigh: true,
    defaultWeight: 0.5,
    defaultEnabled: true,
    unit: 'vol pts',
    compute: (d) => s(d, 'VVIX'),
    doc: {
      what: 'Implied volatility of VIX options: how violently the market expects VIX itself to move.',
      why: 'VVIX rises when traders scramble for VIX calls as tail hedges. It often moves before or with VIX spikes, and a high VVIX with a low VIX can flag fragile calm.',
      range: 'Typical 85–104 (interquartile range since 2010); stressed 120+; extremes 160–210.',
      episodes: 'Aug 2015: 168.8 (24 Aug). Feb 2018: 180.6 (8 Feb). Mar 2020: 207.6 (16 Mar). 2022: mostly 80–133, subdued for a bear market. Series starts 2007.',
    },
  },
  {
    id: 'skew',
    label: 'Cboe SKEW',
    group: 'Sentiment',
    inputs: ['SKEW'],
    riskOffWhenHigh: true,
    defaultWeight: 0.25,
    defaultEnabled: true,
    unit: 'index',
    compute: (d) => s(d, 'SKEW'),
    doc: {
      what: 'Price of far out-of-the-money S&P puts relative to at-the-money options, i.e. the implied probability of a crash-sized move.',
      why: 'High SKEW means heavy demand for crash protection. Its signal is ambiguous: SKEW is often high in calm, hedged markets and falls during crashes as at-the-money vol catches up. That is why its default weight is low.',
      range: '100 = no extra tail pricing; 10th–90th percentile 118–148 since 2010; record close 183.1 (18 Feb 2025).',
      episodes: 'Not a reliable crash predictor: it fell during the 2020 crash (Jan average 131 → Mar average 121), barely moved in 2008 (Jul 112 → Oct 116), and was high in the calm years 2017 (average 135) and 2021 (average 146).',
    },
  },
  {
    id: 'pc_equity',
    label: 'Equity put/call ratio (10d avg)',
    group: 'Sentiment',
    inputs: ['PC_EQUITY'],
    riskOffWhenHigh: true,
    defaultWeight: 0.5,
    defaultEnabled: true,
    unit: 'ratio',
    compute: (d) => sma(s(d, 'PC_EQUITY'), 10),
    doc: {
      what: 'Cboe single-stock put volume divided by call volume, averaged over 10 days.',
      why: 'Puts are mostly bought for protection and calls for upside, so a rising ratio means growing fear or hedging demand. At extremes it is often read as contrarian (peak fear near lows); here it is used as a stress gauge. Flip the direction to test the contrarian reading.',
      range: '10-day average: interquartile 0.60–0.67 in 2010–19; above 0.9 = fear; below 0.5 = speculative call buying.',
      episodes: '2008: 10-day average peaked at 0.98 (21 Nov). 2020–21: fell to 0.38 (26 Jan 2021) on retail call buying, a structural break. 2022: 0.55–0.81, only moderately elevated.',
    },
  },
  {
    id: 'vrp',
    label: 'Variance risk premium (VIX − realised)',
    group: 'Volatility',
    inputs: ['VIX', 'SPX'],
    riskOffWhenHigh: false,
    defaultWeight: 1,
    defaultEnabled: true,
    unit: 'vol pts',
    compute: (d) => zip2(s(d, 'VIX'), realisedVol(s(d, 'SPX'), 21), (v, rv) => v - rv),
    doc: {
      what: 'Implied volatility (VIX) minus the S&P 500’s realised volatility over the past 21 trading days.',
      why: 'Implied vol normally trades above realised (a positive premium paid to insurance sellers). When realised vol overtakes implied (negative VRP), the market is moving more than options priced, which typically happens during disorderly sell-offs. A healthy positive premium is risk-on.',
      range: 'Median +4.2 pts, interquartile +1.7 to +6.3 since 2010; below 0 = realised exceeds implied (stress).',
      episodes: 'Lows: −35.8 (4 Nov 2008), −17.1 (31 Aug 2011), −10.5 (26 Feb 2018), −52.3 (6 Apr 2020). 21-day realised vol peaked at 85 (Oct 2008) and 98 (Apr 2020). Positive on two-thirds of days in 2022.',
    },
  },
  {
    id: 'credit_etf',
    label: 'Credit: HY vs Treasuries (3m relative return)',
    group: 'Credit',
    inputs: ['asset:HYG', 'asset:IEF'],
    riskOffWhenHigh: false,
    defaultWeight: 1,
    defaultEnabled: true,
    unit: '% (63d)',
    compute: (d) => {
      const h = d.assets.HYG?.tr;
      const i = d.assets.IEF?.tr;
      if (!h || !i) return nan(d.dates.length);
      const lr = zip2(h, i, (a, b) => (a > 0 && b > 0 ? Math.log(a / b) : NaN));
      return diff(lr, 63).map((x) => 100 * x);
    },
    doc: {
      what: 'Total return of high-yield bonds (HYG; Vanguard High-Yield fund before 2007) minus 7–10y Treasuries (IEF) over the past 3 months.',
      why: 'Credit spreads widen before and during equity stress as default risk is repriced. Using a total-return spread between tradeable funds needs no FRED data, so it works back to 1990. Weak relative performance is risk-off.',
      range: '10th–90th percentile −4.1% to +5.3% over 3 months since 2010; below −5% = credit stress.',
      episodes: '2008: −41% (11 Dec). 2020: −33% (23 Mar). 2022: worst −7% (6 Jul), because HY bonds and Treasuries fell together as rates rose.',
    },
  },
  {
    id: 'credit_oas',
    label: 'Credit: HY OAS 3m change',
    group: 'Credit',
    inputs: ['HY_OAS'],
    riskOffWhenHigh: true,
    defaultWeight: 1,
    defaultEnabled: false, // FRED is unreachable without an API key (see METHODOLOGY 2.5)
    unit: 'pp (63d)',
    compute: (d) => diff(s(d, 'HY_OAS'), 63),
    doc: {
      what: 'Change over 3 months in the ICE BofA US High Yield option-adjusted spread (FRED, published with a 1-day lag).',
      why: 'The OAS is the market’s direct price of default risk. Widening spreads mean tightening financial conditions and usually lead or coincide with equity drawdowns. If FRED is unavailable this component drops out and the credit ETF proxy carries the credit signal.',
      range: 'Rapid widening over 3 months signals stress.',
      episodes: 'FRED carries only the last ~3 years of ICE BofA spreads (ICE licensing): data from Oct 2023, too short to standardise or backtest, so keep this off and use the Baa−10y component for long-history credit.',
    },
  },
  {
    id: 'credit_baa',
    label: 'Credit: Baa − 10y spread, 3m change',
    group: 'Credit',
    inputs: ['BAA10Y'],
    riskOffWhenHigh: true,
    defaultWeight: 1,
    defaultEnabled: false,
    unit: 'pp (63d)',
    compute: (d) => diff(s(d, 'BAA10Y'), 63),
    doc: {
      what: 'Change over 3 months in Moody’s Baa corporate yield minus the 10-year Treasury yield (FRED BAA10Y, 1-day publication lag).',
      why: 'A long-history measure of credit stress (FRED’s ICE high-yield spreads only go back ~3 years). Investment-grade Baa spreads widen when default and liquidity risk are repriced, typically alongside equity drawdowns.',
      range: '3-month change 10th/50th/90th percentile −0.33 / −0.03 / +0.36 pp since 1990; spread level median 2.13%.',
      episodes: 'Widened +2.81 pp in the 3 months to Dec 2008 (level peaked at 6.16% on 5 Dec 2008), +2.35 pp to Mar 2020 (4.31%), +0.60 pp at most in 2022.',
    },
  },
  {
    id: 'trend',
    label: 'S&P 500 vs 200-day average',
    group: 'Trend',
    inputs: ['SPX'],
    riskOffWhenHigh: false,
    defaultWeight: 1,
    defaultEnabled: true,
    unit: '%',
    compute: (d) => {
      const px = s(d, 'SPX');
      return zip2(px, sma(px, 200), (p, m) => (m > 0 ? 100 * (p / m - 1) : NaN));
    },
    doc: {
      what: 'Percentage distance of the S&P 500 from its 200-day moving average.',
      why: 'A price trend filter. Volatility signals are fast but noisy; trend is slow but confirms whether stress is turning into a bear market. Below the 200-day average, historical equity returns have been lower and much more volatile.',
      range: 'Typically −5% to +10%; below −10% = bear market (low: −39.7% on 20 Nov 2008).',
      episodes: 'Below the average from Nov 2007 to Jun 2009 (95% of days in 2008–H1 2009). It barely touched it in Feb–Apr 2018 (2% of days), so the trend filter missed Volmageddon; the vol components caught it. Below on 71% of days in Mar–Jun 2020 and 85% of 2022.',
    },
  },
  {
    id: 'absorption',
    label: 'Absorption ratio shift (sector PCA)',
    group: 'Correlation',
    inputs: ['AR2_9'],
    riskOffWhenHigh: true,
    defaultWeight: 1,
    defaultEnabled: false,
    unit: 'σ',
    compute: (d) => {
      // Kritzman et al.'s standardised shift: 15-day average vs the past year, in standard deviations
      const ar = s(d, 'AR2_9');
      const { mean, std } = rollingMeanStd(ar, 252, 252);
      return zip2(sma(ar, 15), zip2(mean, std, (m, sd) => (sd > 0 ? m : NaN)), (a, m) => a - m).map((x, t) => x / std[t]!);
    },
    doc: {
      what: 'Shift in the absorption ratio of the 9 original Select Sector SPDRs (XLB, XLE, XLF, XLI, XLK, XLP, XLU, XLV, XLY): the share of their return variance explained by the top 2 of 9 principal components (exponentially weighted covariance of 252 daily returns, half-life 126 days). The component is the 15-day average minus the 1-year average, in 1-year standard deviations (Kritzman, Li, Page and Rigobon, 2010).',
      why: 'A high absorption ratio means sectors move as one block, driven by one or two common factors: diversification is weak and shocks spread. Kritzman et al. found sharp rises preceded large drawdowns. Out of sample here it did not help (METHODOLOGY 15.6): its peaks mostly came at or after the lows.',
      range: 'Absorption ratio 10th/50th/90th percentile 0.68 / 0.80 / 0.89 since 1999 (low 0.58 in Dec 2017, high 0.948 on 24 Mar 2020). Shift 10th/50th/90th percentile −1.98 / +0.06 / +1.67σ since Dec 2000; above +1σ on 29% of days.',
      episodes: 'Shift peaks: +2.09σ on 23 Aug 2007 (before the Oct 2007 top), +2.92σ on 31 Oct 2008 (after Lehman), +2.59σ on 30 Aug 2011, +1.78σ on 5 Mar 2018 (after Volmageddon), +0.82σ on 31 Dec 2018 (after the low), +3.54σ on 27 Mar 2020 (after the low), +2.24σ on 8 Jul 2022.',
    },
  },
  {
    id: 'move',
    label: 'MOVE (Treasury vol)',
    group: 'Macro',
    inputs: ['MOVE'],
    riskOffWhenHigh: true,
    defaultWeight: 0,
    defaultEnabled: false,
    unit: 'bp',
    compute: (d) => s(d, 'MOVE'),
    doc: {
      what: 'ICE BofA MOVE index: implied volatility of US Treasury yields (the "VIX of bonds").',
      why: 'Rate volatility tightens financial conditions and undermines bonds as a hedge, as in 2022. The data comes from Yahoo only, with occasional gaps, so it is off by default.',
      range: 'Interquartile 58–84 in 2010–19; stressed 130+.',
      episodes: '2008: 264.6 (10 Oct). 2020: 163.7 (9 Mar). 2022: mostly 87–148. Mar 2023 (SVB): 182.6 (20 Mar).',
    },
  },
  {
    id: 'nfci',
    label: 'Chicago Fed NFCI',
    group: 'Macro',
    inputs: ['NFCI'],
    riskOffWhenHigh: true,
    defaultWeight: 0,
    defaultEnabled: false,
    unit: 'index',
    compute: (d) => s(d, 'NFCI'),
    doc: {
      what: 'Weekly index of 105 US financial-condition measures (money markets, debt, equity, banking). 0 = average; positive = tighter than average.',
      why: 'A broad, slow-moving measure of financial stress that is good at confirming systemic episodes. It is published weekly with a lag (Friday data on Wednesday), which the pipeline enforces.',
      range: '10th/50th/90th percentile −0.74 / −0.52 / −0.01 since 1990; above 0 = tighter than average.',
      episodes: 'Peaks: 3.11 (Dec 2008), 0.31 (Apr 2020); stayed below 0 in Aug–Oct 2011 (−0.09), 2015–16 (−0.30), Q4 2018 (−0.43) and 2022 (−0.09). A slow, systemic gauge.',
    },
  },
  {
    id: 'stlfsi',
    label: 'St. Louis Fed Financial Stress Index',
    group: 'Macro',
    inputs: ['STLFSI'],
    riskOffWhenHigh: true,
    defaultWeight: 0,
    defaultEnabled: false,
    unit: 'index',
    compute: (d) => s(d, 'STLFSI'),
    doc: {
      what: 'Weekly composite of 18 rates, spreads and volatility measures. 0 = normal stress.',
      why: 'Like the NFCI, a systemic-stress confirmation that is slow and published with a lag.',
      range: '10th/50th/90th percentile −0.77 / −0.21 / +0.81 since 1994; 0 = average stress.',
      episodes: 'Peaks: 9.67 (Oct 2008), 5.63 (Mar 2020), 1.40 (Oct 2011), 1.28 (Feb 2016), 0.56 (Dec 2018), 0.63 (Jul 2022).',
    },
  },
  {
    id: 'curve',
    label: 'Yield curve 10y − 2y',
    group: 'Macro',
    inputs: ['Y10Y', 'Y2Y'],
    riskOffWhenHigh: false,
    defaultWeight: 0,
    defaultEnabled: false,
    unit: 'pp',
    compute: (d) => zip2(s(d, 'Y10Y'), s(d, 'Y2Y'), (a, b) => a - b),
    doc: {
      what: 'Spread between 10-year and 2-year Treasury yields.',
      why: 'Inversion (negative) has preceded most US recessions, but with long and variable lags (6–24 months), so it is a poor timing signal. It is included for exploration and off by default.',
      range: 'Typical 0 to +2.5 pp; negative = inverted.',
      episodes: 'Inverted on about half of days in 2006–07 (before 2008), for 3 days in 2019, and almost continuously from Jul 2022 to Sep 2024, which was followed by an equity rally rather than a crash.',
    },
  },
  // ---------------------------------------------------------------- VTS-style dashboard metrics
  // Definitions follow Volatility Trading Strategies' published descriptions where they exist
  // (VX30, VX30:VIX, Traders VRP, Adjusted M1:M2, Cash VIX Oscillator - the last reconstructed and
  // matched to VTS's published extremes). All off by default: they were added after the
  // default set was fixed, so turning them on is a modelling choice to test, not a given.
  {
    id: 'vts_cvo',
    label: 'Cash VIX Oscillator (VTS)',
    group: 'VTS-style',
    inputs: ['VIX9D', 'VIX', 'VIX3M', 'VIX6M'],
    riskOffWhenHigh: false,
    defaultWeight: 1,
    defaultEnabled: false,
    unit: 'vol pts',
    compute: (d) => {
      const a = s(d, 'VIX3M');
      const b = s(d, 'VIX6M');
      const c = s(d, 'VIX9D');
      const v = s(d, 'VIX');
      const out = new Float64Array(d.dates.length);
      for (let i = 0; i < out.length; i++) out[i] = a[i]! + b[i]! - (c[i]! + v[i]!);
      return out;
    },
    doc: {
      what: '(VIX3M + VIX6M) − (VIX9D + VIX): the long end of the cash VIX curve minus the short end, in vol points.',
      why: 'Summarises the whole cash term structure in one number. Positive = normal upward slope (calm); deeply negative = the front of the curve has spiked above the back (panic). VTS publishes no formula; this reconstruction reproduces both of its published extremes exactly (15.28 on 16 Mar 2012, −43.98 on 5 Feb 2018).',
      range: '10th/50th/90th percentile +0.3 / +6.8 / +11.4 (2011–2026); below 0 = inverted cash curve.',
      episodes: 'Lows: −42.90 (8 Aug 2011), −36.85 (24 Aug 2015), −43.98 (5 Feb 2018), −23.27 (24 Dec 2018), −73.98 (12 Mar 2020); only −6.37 in 2022 (26 Jan). Series starts 2011 (VIX9D).',
    },
  },
  {
    id: 'vts_vx30_roll',
    label: 'VX30:VIX roll yield (VTS)',
    group: 'VTS-style',
    inputs: ['VX30', 'VIX'],
    riskOffWhenHigh: false,
    defaultWeight: 1,
    defaultEnabled: false,
    unit: '%',
    compute: (d) => zip2(s(d, 'VX30'), s(d, 'VIX'), (f, v) => (v > 0 ? 100 * (f / v - 1) : NaN)),
    doc: {
      what: '(VX30 − VIX) / VIX, where VX30 is a 1-month constant-maturity VIX future rolled from M1 into M2 over each expiry cycle in trading days (VTS definition).',
      why: 'The basis between futures and spot: futures converge to spot at expiry, so a positive basis is the roll yield short-volatility products earn and long-volatility products pay. A negative basis (futures below spot) means the market expects today’s fear to fade — typical of acute stress.',
      range: '10th/50th/90th percentile −4.1% / +8.6% / +18.5% (2004–2026); negative = futures below spot.',
      episodes: 'Lows: −36.8% (10 Oct 2008), −32.5% (8 Aug 2011), −39.4% (24 Aug 2015), −31.4% (8 Feb 2018), −37.3% (28 Feb 2020); negative on 31% of 2022 days (low −10.8%).',
    },
  },
  {
    id: 'vts_traders_vrp',
    label: 'Traders VRP (VTS)',
    group: 'VTS-style',
    inputs: ['VX30', 'SPX'],
    riskOffWhenHigh: false,
    defaultWeight: 1,
    defaultEnabled: false,
    unit: 'vol pts',
    compute: (d) => wma(zip2(s(d, 'VX30'), realisedVol(s(d, 'SPX'), 5), (f, h) => f - h), 5),
    doc: {
      what: '5-day linearly weighted moving average of (VX30 − 5-day S&P 500 historical volatility) (VTS definition).',
      why: 'A faster, tradeable version of the variance risk premium: VX30 is what volatility futures actually charge, and 5-day realised volatility reacts within days. Negative = recent realised moves exceed what futures price.',
      range: '10th/50th/90th percentile −1.2 / +6.2 / +11.9 pts; negative on 12.3% of days since 2004 (VTS reports ~13%) and 23.9% of days in 2018 (VTS: "nearly 25%").',
      episodes: 'Lows: −73.3 (17 Oct 2008), −48.3 (12 Aug 2011), −21.6 (28 Aug 2015), −18.0 (12 Feb 2018), −20.4 (31 Dec 2018), −83.3 (18 Mar 2020); negative on 20% of 2022 days.',
    },
  },
  {
    id: 'vts_adj_m1m2',
    label: 'Adjusted M1:M2 contango (VTS)',
    group: 'VTS-style',
    inputs: ['VX30', 'VX_ADJ_M2'],
    riskOffWhenHigh: false,
    defaultWeight: 1,
    defaultEnabled: false,
    unit: '%',
    compute: (d) => zip2(s(d, 'VX_ADJ_M2'), s(d, 'VX30'), (b, a) => (a > 0 ? 100 * (b / a - 1) : NaN)),
    doc: {
      what: 'Contango between the roll-adjusted first and second months: adjusted M1 = VX30 (M1→M2 roll), adjusted M2 = the same roll applied to M2→M3 (VTS definition).',
      why: 'The raw M1:M2 spread jumps at every expiry because the front contract’s maturity shrinks to zero; rolling both legs through the cycle gives a smooth, comparable contango measure. Conceptually the same as the CM30/CM60 slope already in the model, so expect high correlation.',
      range: '10th/50th/90th percentile −1.6% / +5.3% / +9.7%; negative = backwardation.',
      episodes: 'Lows: −22.3% (27 Oct 2008), −10.1% (19 Aug 2011), −9.8% (25 Aug 2015), −13.3% (5 Feb 2018), −23.5% (16 Mar 2020), −4.7% (7 Mar 2022).',
    },
  },
  {
    id: 'vts_m4m7',
    label: 'M4–M7 VIX futures contango',
    group: 'VTS-style',
    inputs: ['VX4', 'VX7'],
    riskOffWhenHigh: false,
    defaultWeight: 1,
    defaultEnabled: false,
    unit: '%',
    compute: (d) => zip2(s(d, 'VX7'), s(d, 'VX4'), (a, b) => (b > 0 ? 100 * (a / b - 1) : NaN)),
    doc: {
      what: '(M7 − M4) / M4: slope of the middle of the VIX futures curve (4th to 7th listed monthly contracts). VTS lists the metric without a formula; this is the natural reading.',
      why: 'The front of the curve reacts to today’s fear; the 4–7 month segment reflects how long the market expects elevated volatility to last. A flat or inverted mid-curve signals persistent, not transient, stress.',
      range: '10th/50th/90th percentile −2.0% / +4.2% / +10.7% (2006–2026); negative = mid-curve inverted.',
      episodes: 'Deeply inverted only in prolonged crises: −16.3% (18 Nov 2008), −25.8% (17 Mar 2020); −5.6% in Feb 2018 and −6.2% in May 2022; barely negative in Aug 2015 (−0.9%). A 7th contract exists from Apr 2006.',
    },
  },
  {
    id: 'vix9d_fast',
    label: 'VIX9D:VIX fast crossover',
    group: 'VTS-style',
    inputs: ['VIX9D', 'VIX'],
    riskOffWhenHigh: true,
    defaultWeight: 1,
    defaultEnabled: false,
    unit: 'ratio',
    compute: (d) => ratio(s(d, 'VIX9D'), s(d, 'VIX')),
    doc: {
      what: 'VIX9D / VIX: 9-day vs 30-day implied volatility. A "crossover" is the ratio moving above 1.',
      why: 'The fastest term-structure signal: the 9-day horizon reacts to imminent events within hours. Noisy (event days, Fed meetings, earnings), so best combined with slower measures.',
      range: '10th/50th/90th percentile 0.83 / 0.94 / 1.06 (2011–2026); above 1 = near-term stress.',
      episodes: 'Peaks: 1.42 (8 Aug 2011), 1.39 (21 Aug 2015), 1.59 (5 Feb 2018), 1.26 (24 Oct 2018), 1.40 (27 Feb 2020), 1.20 (24 Jan 2022). Series starts 2011.',
    },
  },
  {
    id: 'vix6m_slow',
    label: 'VIX:VIX6M slow crossover',
    group: 'VTS-style',
    inputs: ['VIX', 'VIX6M'],
    riskOffWhenHigh: true,
    defaultWeight: 1,
    defaultEnabled: false,
    unit: 'ratio',
    compute: (d) => ratio(s(d, 'VIX'), s(d, 'VIX6M')),
    doc: {
      what: 'VIX / VIX6M: 30-day vs 6-month implied volatility. A "crossover" is the ratio moving above 1.',
      why: 'The slow term-structure signal: only crosses 1 when stress is deep enough to invert the curve out to six months, so fewer false alarms than VIX:VIX3M but later.',
      range: '10th/50th/90th percentile 0.72 / 0.82 / 0.99 (2008–2026); above 1 = deep inversion.',
      episodes: 'Peaks: 1.56 (7 Oct 2008), 1.37 (8 Aug 2011), 1.49 (24 Aug 2015), 1.52 (5 Feb 2018), 1.58 (12 Mar 2020); only 1.06 in 2022 (7 Mar). Series starts 2008.',
    },
  },
  {
    id: 'vx30_level',
    label: 'VX30 level (constant-maturity VIX future)',
    group: 'VTS-style',
    inputs: ['VX30'],
    riskOffWhenHigh: true,
    defaultWeight: 1,
    defaultEnabled: false,
    unit: 'vol pts',
    compute: (d) => s(d, 'VX30'),
    doc: {
      what: 'Level of the 1-month constant-maturity VIX future (VTS VX30).',
      why: 'The price of 1-month volatility in the futures market. Moves almost one-for-one with spot VIX, so it adds little beyond the VIX component; included for completeness.',
      range: 'VX30 − VIX: 10th/50th/90th percentile −0.9 / +1.4 / +2.9 pts.',
      episodes: 'Peaks far below spot in crises because futures price mean reversion: 25.8 pts below VIX on 10 Oct 2008, 27.2 pts below on 12 Mar 2020.',
    },
  },
  {
    id: 'vix_voli_resid',
    label: 'VIX − VOLI residual',
    group: 'VTS-style',
    inputs: ['VIX', 'VOLI'],
    riskOffWhenHigh: true,
    defaultWeight: 1,
    defaultEnabled: false,
    unit: 'vol pts',
    compute: (d) => rollingResidual(s(d, 'VIX'), s(d, 'VOLI'), 252, 126),
    doc: {
      what: 'VIX minus the value predicted from VOLI (at-the-money SPY implied vol) by a regression fitted on the trailing year. VTS lists the metric without a formula; this is a transparent version.',
      why: 'VIX prices the whole option strip, including out-of-the-money puts; VOLI prices only at-the-money options. What VIX shows beyond VOLI is the premium for crash protection (skew). A rising residual = hedging demand building beneath the surface. Direction is debatable (high skew can coincide with calm, well-hedged markets), so test both ways.',
      range: '5th/95th percentile −1.5 / +1.6 pts (std 1.0); centred near 0 by construction.',
      episodes: 'Spikes: +6.3 pts in Feb 2018, +11.1 pts in Mar 2020, +1.4 pts at most in 2022. VOLI starts June 2013, so the residual starts Dec 2013.',
    },
  },
];

export const COMPONENT_BY_ID: Record<string, ComponentDef> = Object.fromEntries(
  COMPONENTS.map((c) => [c.id, c]),
);
