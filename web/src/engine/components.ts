/**
 * Signal component registry.
 *
 * Each component turns raw market series into one feature per day. The score
 * engine then standardises the feature (rolling percentile or z-score) and
 * orients it so that 100 = risk-on and 0 = risk-off.
 */

import type { MarketData } from './data';
import { diff, realisedVol, sma, zip2 } from './stats';

export type ComponentGroup = 'Volatility' | 'Term structure' | 'Sentiment' | 'Credit' | 'Macro' | 'Trend';

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
      range: 'Rapid widening over 3 months signals stress; levels are not shown because FRED data is unavailable in this build.',
      episodes: 'Spreads widened sharply in 2008 and Mar 2020 and more gradually in 2022. Numbers are omitted because they cannot be checked against this dataset.',
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
      range: 'Below 0 = looser than average; above 0 = tighter than average.',
      episodes: 'Rose sharply in 2008, briefly in Mar 2020 and gradually in 2022. Numbers are omitted because FRED data is unavailable in this build.',
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
      range: '0 = average stress; strongly positive readings = systemic stress.',
      episodes: 'Spiked in 2008 and Mar 2020. Numbers are omitted because FRED data is unavailable in this build.',
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
];

export const COMPONENT_BY_ID: Record<string, ComponentDef> = Object.fromEntries(
  COMPONENTS.map((c) => [c.id, c]),
);
