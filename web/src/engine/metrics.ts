/**
 * Performance statistics on daily NAV series.
 *
 * Conventions: 252 trading days per year for volatility; CAGR uses calendar
 * time; Sharpe/Sortino use daily returns in excess of the T-bill (CASH) return;
 * capture ratios and hit rate use calendar-month returns vs the reference.
 */

const DAYS = 252;

export interface Metrics {
  start: string;
  end: string;
  years: number;
  totalReturn: number;
  cagr: number;
  vol: number;
  sharpe: number;
  sortino: number;
  maxDrawdown: number;
  maxDrawdownStart: string;
  maxDrawdownTrough: string;
  calmar: number;
  ulcer: number;
  beta: number;
  correlation: number;
  /** One-way annual turnover (1.0 = the whole portfolio traded once a year). */
  turnover: number;
  /** Average years between full turnovers, i.e. 1 / turnover. */
  avgHoldingYears: number;
  /** Transaction costs paid per year, as a fraction of NAV. */
  costDrag: number;
  positiveMonths: number;
  /** Share of months beating the reference. */
  hitRate: number;
  worstMonth: number;
  worstYear: number;
  bestYear: number;
  upCapture: number;
  downCapture: number;
}

export interface MonthlyReturn {
  year: number;
  month: number; // 1-12
  ret: number;
}

/** Calendar-month returns from a NAV series over [s, e]. */
export function monthlyReturns(dates: string[], nav: Float64Array, s: number, e: number): MonthlyReturn[] {
  const out: MonthlyReturn[] = [];
  let prevNav = nav[s]!;
  for (let t = s + 1; t <= e; t++) {
    const lastOfMonth = t === e || dates[t + 1]!.slice(0, 7) !== dates[t]!.slice(0, 7);
    if (lastOfMonth) {
      out.push({ year: +dates[t]!.slice(0, 4), month: +dates[t]!.slice(5, 7), ret: nav[t]! / prevNav - 1 });
      prevNav = nav[t]!;
    }
  }
  return out;
}

export function yearlyReturns(m: MonthlyReturn[]): { year: number; ret: number }[] {
  const by = new Map<number, number>();
  for (const x of m) by.set(x.year, (by.get(x.year) ?? 1) * (1 + x.ret));
  return [...by.entries()].map(([year, g]) => ({ year, ret: g - 1 }));
}

export function drawdown(nav: Float64Array, s: number, e: number): Float64Array {
  const dd = new Float64Array(nav.length).fill(NaN);
  let peak = -Infinity;
  for (let t = s; t <= e; t++) {
    peak = Math.max(peak, nav[t]!);
    dd[t] = nav[t]! / peak - 1;
  }
  return dd;
}

function mean(a: number[]): number {
  return a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
}

function std(a: number[]): number {
  if (a.length < 2) return NaN;
  const m = mean(a);
  return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1));
}

function geoMean(a: number[]): number {
  if (!a.length) return NaN;
  return Math.exp(a.reduce((x, r) => x + Math.log(1 + r), 0) / a.length) - 1;
}

export function computeMetrics(
  dates: string[],
  nav: Float64Array,
  s: number,
  e: number,
  cashReturns: Float64Array,
  refNav: Float64Array,
  turnover?: Float64Array,
  costs?: Float64Array,
): Metrics {
  const r: number[] = [];
  const ex: number[] = [];
  const ref: number[] = [];
  for (let t = s + 1; t <= e; t++) {
    const rt = nav[t]! / nav[t - 1]! - 1;
    r.push(rt);
    ex.push(rt - (Number.isFinite(cashReturns[t]!) ? cashReturns[t]! : 0));
    ref.push(refNav[t]! / refNav[t - 1]! - 1);
  }
  const days = (Date.parse(dates[e]!) - Date.parse(dates[s]!)) / 86_400_000;
  const years = days / 365.25;
  const total = nav[e]! / nav[s]! - 1;
  const cagr = years > 0 ? Math.pow(1 + total, 1 / years) - 1 : NaN;
  const vol = std(r) * Math.sqrt(DAYS);
  const sharpe = (mean(ex) / std(ex)) * Math.sqrt(DAYS);
  const downside = Math.sqrt(mean(ex.map((x) => Math.min(0, x) ** 2)));
  const sortino = (mean(ex) * DAYS) / (downside * Math.sqrt(DAYS));

  // drawdown statistics
  let peak = nav[s]!;
  let peakIdx = s;
  let mdd = 0;
  let mddPeak = s;
  let mddTrough = s;
  let sq = 0;
  for (let t = s; t <= e; t++) {
    if (nav[t]! > peak) {
      peak = nav[t]!;
      peakIdx = t;
    }
    const dd = nav[t]! / peak - 1;
    sq += (100 * dd) ** 2;
    if (dd < mdd) {
      mdd = dd;
      mddPeak = peakIdx;
      mddTrough = t;
    }
  }
  const ulcer = Math.sqrt(sq / (e - s + 1));

  // beta / correlation vs reference (daily)
  const mr = mean(r);
  const mf = mean(ref);
  let cov = 0;
  let vr = 0;
  let vf = 0;
  for (let i = 0; i < r.length; i++) {
    cov += (r[i]! - mr) * (ref[i]! - mf);
    vr += (r[i]! - mr) ** 2;
    vf += (ref[i]! - mf) ** 2;
  }

  const mStrat = monthlyReturns(dates, nav, s, e);
  const mRef = monthlyReturns(dates, refNav, s, e);
  const up: number[] = [];
  const upRef: number[] = [];
  const dn: number[] = [];
  const dnRef: number[] = [];
  let hits = 0;
  for (let i = 0; i < mStrat.length; i++) {
    const a = mStrat[i]!.ret;
    const b = mRef[i]!.ret;
    if (a > b) hits++;
    if (b >= 0) {
      up.push(a);
      upRef.push(b);
    } else {
      dn.push(a);
      dnRef.push(b);
    }
  }
  const yrs = yearlyReturns(mStrat);
  let to = 0;
  if (turnover) for (let t = s; t <= e; t++) to += turnover[t]!;
  const annualTurnover = years > 0 ? to / years : NaN;
  let paid = 0;
  if (costs) for (let t = s + 1; t <= e; t++) paid += costs[t]!;

  return {
    start: dates[s]!,
    end: dates[e]!,
    years,
    totalReturn: total,
    cagr,
    vol,
    sharpe,
    sortino,
    maxDrawdown: mdd,
    maxDrawdownStart: dates[mddPeak]!,
    maxDrawdownTrough: dates[mddTrough]!,
    calmar: mdd < 0 ? cagr / -mdd : NaN,
    ulcer,
    beta: vf > 0 ? cov / vf : NaN,
    correlation: vr > 0 && vf > 0 ? cov / Math.sqrt(vr * vf) : NaN,
    turnover: annualTurnover,
    avgHoldingYears: annualTurnover > 0 ? 1 / annualTurnover : NaN,
    costDrag: costs && years > 0 ? paid / years : NaN,
    positiveMonths: mStrat.length ? mStrat.filter((m) => m.ret > 0).length / mStrat.length : NaN,
    hitRate: mStrat.length ? hits / mStrat.length : NaN,
    worstMonth: Math.min(...mStrat.map((m) => m.ret)),
    worstYear: Math.min(...yrs.map((y) => y.ret)),
    bestYear: Math.max(...yrs.map((y) => y.ret)),
    upCapture: geoMean(up) / geoMean(upRef),
    downCapture: geoMean(dn) / geoMean(dnRef),
  };
}

/** Rolling trailing-window total return and Sharpe ratio (window in trading days). */
export function rollingStats(
  nav: Float64Array,
  cash: Float64Array,
  s: number,
  e: number,
  window = 252,
): { ret: Float64Array; sharpe: Float64Array } {
  const n = nav.length;
  const ret = new Float64Array(n).fill(NaN);
  const sharpe = new Float64Array(n).fill(NaN);
  let sum = 0;
  let sum2 = 0;
  const ex = new Float64Array(n).fill(NaN);
  for (let t = s + 1; t <= e; t++) ex[t] = nav[t]! / nav[t - 1]! - 1 - (Number.isFinite(cash[t]!) ? cash[t]! : 0);
  for (let t = s + 1; t <= e; t++) {
    sum += ex[t]!;
    sum2 += ex[t]! ** 2;
    if (t - window > s) {
      sum -= ex[t - window]!;
      sum2 -= ex[t - window]! ** 2;
    }
    if (t - window >= s) {
      ret[t] = nav[t]! / nav[t - window]! - 1;
      const m = sum / window;
      const sd = Math.sqrt(Math.max(0, (sum2 - window * m * m) / (window - 1)));
      sharpe[t] = sd > 0 ? (m / sd) * Math.sqrt(DAYS) : NaN;
    }
  }
  return { ret, sharpe };
}
