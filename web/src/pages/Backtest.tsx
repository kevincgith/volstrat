import { useMemo, useRef, useState } from 'react';
import { Chart, type ChartHandle } from '../charts/Chart';
import { baseOption, line, num, pct, regimeAreas, timeAxis, valueAxis, zoom } from '../charts/options';
import { assetColor, colors, entityColor, type Colors } from '../charts/palette';
import { assetLabel, ParamPanel } from '../components/ParamPanel';
import { BootstrapCard } from '../components/BootstrapCard';
import { CostCard } from '../components/CostCard';
import { Robustness } from '../components/Robustness';
import { Card, ErrorBox, Loading, Segmented, Toggle } from '../components/ui';
import { COMPONENTS } from '../engine/components';
import type { Metrics } from '../engine/metrics';
import { drawdown, monthlyReturns, rollingStats, yearlyReturns } from '../engine/metrics';
import { REGIMES } from '../engine/score';
import type { WireResult } from '../engine/wire';
import { downloadText, toCsv } from '../lib/csv';
import { useData } from '../state/data';
import { useParams } from '../state/params';
import { useRun } from '../state/useRun';
import { useTheme } from '../theme';

type Run = WireResult['strategy'];

const STAT_ROWS: { key: keyof Metrics; label: string; fmt: (v: number) => string; hint: string }[] = [
  { key: 'cagr', label: 'CAGR', fmt: (v) => pct(v), hint: 'Compound annual growth rate' },
  { key: 'vol', label: 'Volatility', fmt: (v) => pct(v), hint: 'Annualised standard deviation of daily returns' },
  { key: 'sharpe', label: 'Sharpe', fmt: (v) => num(v), hint: 'Excess return over T-bills per unit of volatility' },
  { key: 'sortino', label: 'Sortino', fmt: (v) => num(v), hint: 'Excess return per unit of downside deviation' },
  { key: 'maxDrawdown', label: 'Max drawdown', fmt: (v) => pct(v), hint: 'Largest peak-to-trough decline' },
  { key: 'calmar', label: 'Calmar', fmt: (v) => num(v), hint: 'CAGR / |max drawdown|' },
  { key: 'ulcer', label: 'Ulcer index', fmt: (v) => num(v, 1), hint: 'RMS of % drawdowns: depth and duration of losses' },
  { key: 'beta', label: 'Beta to S&P 500', fmt: (v) => num(v), hint: 'Daily-return beta' },
  { key: 'correlation', label: 'Correlation to S&P 500', fmt: (v) => num(v), hint: 'Daily-return correlation' },
  { key: 'upCapture', label: 'Upside capture', fmt: (v) => pct(v, 0), hint: 'Geometric mean return in S&P up months vs S&P' },
  { key: 'downCapture', label: 'Downside capture', fmt: (v) => pct(v, 0), hint: 'Geometric mean return in S&P down months vs S&P (lower is better)' },
  { key: 'hitRate', label: 'Hit rate vs S&P 500', fmt: (v) => pct(v, 0), hint: 'Share of months beating the S&P 500' },
  { key: 'positiveMonths', label: 'Positive months', fmt: (v) => pct(v, 0), hint: 'Share of months with a positive return' },
  { key: 'worstMonth', label: 'Worst month', fmt: (v) => pct(v), hint: '' },
  { key: 'worstYear', label: 'Worst calendar year', fmt: (v) => pct(v), hint: 'Partial first/last years included' },
  { key: 'bestYear', label: 'Best calendar year', fmt: (v) => pct(v), hint: 'Partial first/last years included' },
  { key: 'turnover', label: 'Turnover (one-way, p.a.)', fmt: (v) => `${num(v, 1)}x`, hint: '1.0x = whole portfolio traded once a year' },
  { key: 'costDrag', label: 'Cost drag (p.a.)', fmt: (v) => pct(v, 2), hint: 'Transaction costs paid per year, % of NAV' },
  { key: 'avgHoldingYears', label: 'Avg holding period', fmt: (v) => (Number.isFinite(v) ? `${(v * 12).toFixed(1)} mo` : '–'), hint: '1 / turnover' },
];

const DEFAULT_BENCH = ['spx', '60/40', 'voltarget'];

function syntheticAreas(r: WireResult, dates: string[], c: Colors) {
  const res = r.strategy.result;
  const data: unknown[] = [];
  let open = -1;
  for (let t = res.start; t <= res.end + 1; t++) {
    let syn = false;
    if (t <= res.end) {
      for (const [k, w] of Object.entries(res.weights)) {
        if ((w[t] ?? 0) > 0 && r.assets[k]?.synthetic[t]) {
          syn = true;
          break;
        }
      }
    }
    if (syn && open < 0) open = t;
    if (!syn && open >= 0) {
      data.push([{ xAxis: dates[open], name: 'proxy / synthetic data' }, { xAxis: dates[t - 1] }]);
      open = -1;
    }
  }
  return {
    silent: true,
    label: { show: true, position: 'insideTop', color: c.muted, fontSize: 10 },
    itemStyle: { color: c.neutral, opacity: 0.5 },
    data,
  };
}

export default function Backtest() {
  const { data, error } = useData();
  const [params, setParams] = useParams();
  const { result, running, ms, error: runErr } = useRun(data, params);
  const { theme } = useTheme();
  const c = colors(theme);
  const [bench, setBench] = useState<string[]>(DEFAULT_BENCH);
  const [split, setSplit] = useState<'full' | 'is' | 'oos'>('full');
  const [copied, setCopied] = useState(false);
  const refs = {
    equity: useRef<ChartHandle>(null),
    dd: useRef<ChartHandle>(null),
    alloc: useRef<ChartHandle>(null),
    roll: useRef<ChartHandle>(null),
    heat: useRef<ChartHandle>(null),
  };

  const availability = useMemo(() => {
    const out: Record<string, string | null> = {};
    if (!data) return out;
    for (const comp of COMPONENTS) {
      const firsts = comp.inputs.map((k) => (k.startsWith('asset:') ? data.assets[k.slice(6)]?.segments[0]?.from ?? null : data.seriesMeta[k]?.first ?? null));
      out[comp.id] = firsts.some((f) => !f) ? null : firsts.sort().at(-1)!;
    }
    return out;
  }, [data]);

  const runs: Run[] = useMemo(() => (result ? [result.strategy, ...result.benchmarks.filter((b) => bench.includes(b.id))] : []), [result, bench]);

  const charts = useMemo(() => {
    if (!data || !result) return null;
    const s = result.start;
    const e = result.end;
    const dates = data.dates.slice(s, e + 1);
    const slice = (x: ArrayLike<number>) => Array.from(x).slice(s, e + 1);
    const cash = result.assets.CASH!.returns;
    const legend = { ...baseOption(c).legend, data: runs.map((r) => r.label) };

    const equity = {
      ...baseOption(c),
      legend,
      grid: { left: 56, right: 16, top: 36, bottom: 48 },
      xAxis: timeAxis(c, dates),
      yAxis: valueAxis(c, { type: 'log', min: (v: { min: number }) => v.min * 0.95, max: (v: { max: number }) => v.max * 1.05, axisLabel: { color: c.muted, formatter: (v: number) => `${v.toFixed(v < 10 ? 1 : 0)}` } }),
      dataZoom: zoom(0),
      tooltip: { ...baseOption(c).tooltip, valueFormatter: (v: number) => (v == null ? '–' : v.toFixed(3)) },
      series: runs.map((r, i) => ({
        ...line(r.label, slice(r.result.nav), entityColor(c, r.id), { z: r.id === 'strategy' ? 5 : 2, lineStyle: { width: 2, color: entityColor(c, r.id), opacity: r.id === 'strategy' ? 1 : 0.85 } }),
        ...(i === 0
          ? {
              markArea: syntheticAreas(result, data.dates, c),
              markLine:
                result.oos > s && result.oos < e
                  ? { silent: true, symbol: 'none', lineStyle: { color: c.ink2, type: 'dashed', width: 1 }, label: { formatter: 'out-of-sample →', color: c.ink2, position: 'insideStartTop' }, data: [{ xAxis: data.dates[result.oos] }] }
                  : undefined,
            }
          : {}),
      })),
    };

    const dd = {
      ...baseOption(c),
      legend,
      grid: { left: 56, right: 16, top: 36, bottom: 28 },
      xAxis: timeAxis(c, dates),
      yAxis: valueAxis(c, { scale: false, max: 0, axisLabel: { color: c.muted, formatter: (v: number) => `${(v * 100).toFixed(0)}%` } }),
      tooltip: { ...baseOption(c).tooltip, valueFormatter: (v: number) => pct(v) },
      series: runs.map((r) => line(r.label, slice(drawdown(r.result.nav, r.result.start, r.result.end)), entityColor(c, r.id), { z: r.id === 'strategy' ? 5 : 2 })),
    };

    const wKeys = Object.keys(result.strategy.result.weights).filter((k) => {
      const w = result.strategy.result.weights[k]!;
      for (let t = s; t <= e; t++) if ((w[t] ?? 0) > 1e-6) return true;
      return false;
    });
    const alloc = {
      ...baseOption(c),
      legend: { ...baseOption(c).legend, data: wKeys.map(assetLabel) },
      grid: [
        { left: 56, right: 16, top: 40, height: 176 },
        { left: 56, right: 16, top: 240, height: 56 },
      ],
      axisPointer: { link: [{ xAxisIndex: 'all' }] },
      xAxis: [timeAxis(c, dates, 0, false), timeAxis(c, dates, 1)],
      yAxis: [
        valueAxis(c, { gridIndex: 0, scale: false, min: 0, max: (v: { max: number }) => Math.max(1, Math.ceil((v.max - 1e-6) * 10) / 10), axisLabel: { color: c.muted, formatter: (v: number) => `${(v * 100).toFixed(0)}%` } }),
        valueAxis(c, { gridIndex: 1, scale: false, min: 0, max: 100, interval: 50, name: 'Score', nameTextStyle: { color: c.muted } }),
      ],
      dataZoom: zoom([0, 1]),
      tooltip: { ...baseOption(c).tooltip, valueFormatter: (v: number) => (v == null ? '–' : `${(v * 100).toFixed(0)}%`) },
      series: [
        ...wKeys.map((k) => ({
          name: assetLabel(k),
          type: 'line',
          stack: 'w',
          xAxisIndex: 0,
          yAxisIndex: 0,
          showSymbol: false,
          sampling: 'lttb',
          lineStyle: { width: 0 },
          areaStyle: { color: assetColor(c, k), opacity: 0.9 },
          itemStyle: { color: assetColor(c, k) },
          data: slice(result.strategy.result.weights[k]!).map((v) => (Number.isFinite(v) ? v : 0)),
        })),
        {
          ...line('Score', slice(result.score.score), c.ink2, { lineStyle: { width: 1.5, color: c.ink2 } }),
          xAxisIndex: 1,
          yAxisIndex: 1,
          tooltip: { valueFormatter: (v: number) => (v == null ? '–' : v.toFixed(1)) },
          markArea: regimeAreas(dates, slice(result.regimes), c),
        },
      ],
    };

    const rolls = runs.map((r) => ({ r, ...rollingStats(r.result.nav, cash, r.result.start, r.result.end) }));
    const roll = {
      ...baseOption(c),
      legend,
      grid: [
        { left: 56, right: 16, top: 52, height: 120 },
        { left: 56, right: 16, top: 212, height: 104 },
      ],
      axisPointer: { link: [{ xAxisIndex: 'all' }] },
      xAxis: [timeAxis(c, dates, 0, false), timeAxis(c, dates, 1)],
      yAxis: [
        valueAxis(c, { gridIndex: 0, name: 'Rolling 1Y return', nameTextStyle: { color: c.muted, align: 'left' }, axisLabel: { color: c.muted, formatter: (v: number) => `${(v * 100).toFixed(0)}%` } }),
        valueAxis(c, { gridIndex: 1, name: 'Rolling 1Y Sharpe', nameTextStyle: { color: c.muted, align: 'left' } }),
      ],
      dataZoom: zoom([0, 1]),
      series: [
        ...rolls.map(({ r, ret }) => ({ ...line(r.label, slice(ret), entityColor(c, r.id), { z: r.id === 'strategy' ? 5 : 2 }), xAxisIndex: 0, yAxisIndex: 0, tooltip: { valueFormatter: (v: number) => pct(v) } })),
        ...rolls.map(({ r, sharpe }) => ({ ...line(r.label, slice(sharpe), entityColor(c, r.id), { z: r.id === 'strategy' ? 5 : 2 }), xAxisIndex: 1, yAxisIndex: 1, tooltip: { valueFormatter: (v: number) => num(v) } })),
      ],
    };

    const months = monthlyReturns(data.dates, result.strategy.result.nav, s, e);
    const years = yearlyReturns(months);
    const yList = years.map((y) => String(y.year)).reverse();
    const cells: [number, number, number][] = months.map((m) => [m.month - 1, yList.indexOf(String(m.year)), m.ret]);
    for (const y of years) cells.push([12, yList.indexOf(String(y.year)), y.ret]);
    const lim = Math.max(0.05, ...months.map((m) => Math.abs(m.ret)));
    const heat = {
      ...baseOption(c),
      legend: { show: false },
      tooltip: {
        ...baseOption(c).tooltip,
        trigger: 'item',
        formatter: (p: { value: [number, number, number] }) => `${yList[p.value[1]]} ${p.value[0] === 12 ? 'full year' : 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ')[p.value[0]]}: <b>${pct(p.value[2])}</b>`,
      },
      grid: { left: 48, right: 16, top: 8, bottom: 56 },
      xAxis: { type: 'category', data: [...'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' '), 'Year'], axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: c.muted }, splitArea: { show: false } },
      yAxis: { type: 'category', data: yList, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: c.muted } },
      visualMap: { type: 'continuous', min: -lim, max: lim, calculable: false, orient: 'horizontal', left: 'center', bottom: 4, itemHeight: 140, itemWidth: 10, inRange: { color: [c.neg, c.neutral, c.pos] }, textStyle: { color: c.muted }, formatter: (v: number) => pct(v, 0), dimension: 2 },
      series: [
        {
          type: 'heatmap',
          data: cells,
          itemStyle: { borderColor: c.surface, borderWidth: 2, borderRadius: 3 },
          label: { show: true, color: c.ink, fontSize: 10, formatter: (p: { value: [number, number, number] }) => (p.value[2] * 100).toFixed(1) },
        },
      ],
    };
    return { equity, dd, alloc, roll, heat, heatHeight: Math.max(220, yList.length * 22 + 70) };
  }, [data, result, runs, c]);

  if (error) return <ErrorBox message={error} />;
  if (!data) return <Loading />;

  const metricsOf = (r: Run): Metrics | undefined => (split === 'is' ? r.inSample : split === 'oos' ? r.outOfSample : r.metrics);
  const hasSplit = !!result?.strategy.inSample;

  const exportDaily = () => {
    if (!result) return;
    const s = result.start;
    const e = result.end;
    const wKeys = Object.keys(result.strategy.result.weights);
    const header = ['date', 'score', 'regime', ...runs.map((r) => `nav_${r.id}`), ...wKeys.map((k) => `w_${k}`)];
    const rows = [];
    for (let t = s; t <= e; t++) {
      const rg = result.regimes[t]!;
      rows.push([data.dates[t]!, result.score.score[t]!, rg >= 0 ? REGIMES[rg] : '', ...runs.map((r) => r.result.nav[t]!), ...wKeys.map((k) => result.strategy.result.weights[k]![t] ?? 0)]);
    }
    downloadText(`volstrat-backtest-daily-${data.dates[e]}.csv`, toCsv(header, rows));
  };
  const exportStats = () => {
    if (!result) return;
    const header = ['metric', ...runs.map((r) => r.label)];
    const rows = STAT_ROWS.map((row) => [row.label, ...runs.map((r) => metricsOf(r)?.[row.key] as number)]);
    downloadText(`volstrat-stats-${split}.csv`, toCsv(header, rows));
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked: the URL bar already holds the link
    }
  };

  return (
    <section className="page backtest">
      <div className="page-head">
        <h1>Backtest</h1>
        <p className="muted">Hypothetical simulation of the score-driven allocation. Every change re-runs instantly; the URL keeps the configuration, so it can be bookmarked or shared.</p>
      </div>
      <div className="bt-layout">
        <aside className="bt-side">
          <ParamPanel params={params} setParams={setParams} regimeColors={c.regime} availability={availability} />
        </aside>
        <div className="bt-main">
          <div className="toolbar">
            <span className="muted small" aria-live="polite">
              {running ? 'Running…' : result ? `${data.dates[result.start]} → ${data.dates[result.end]} · computed in ${ms.toFixed(0)} ms` : ''}
            </span>
            <span className="grow" />
            <button className="btn" onClick={copyLink}>{copied ? 'Link copied' : 'Copy link'}</button>
            <button className="btn" onClick={exportDaily} disabled={!result}>Daily CSV</button>
            <button className="btn" onClick={exportStats} disabled={!result}>Stats CSV</button>
          </div>
          {runErr && <ErrorBox message={runErr} />}
          {result?.notes.map((n) => (
            <p key={n} className="note small">ⓘ {n}</p>
          ))}
          {!result || !charts ? (
            <Loading label="Running backtest…" />
          ) : (
            <>
              <Card
                title="Statistics"
                actions={
                  <>
                    {hasSplit && (
                      <Segmented
                        ariaLabel="Sample"
                        value={split}
                        onChange={setSplit}
                        options={[
                          { value: 'full', label: 'Full' },
                          { value: 'is', label: 'In-sample' },
                          { value: 'oos', label: 'Out-of-sample' },
                        ]}
                      />
                    )}
                  </>
                }
              >
                <div className="bench-picker">
                  <span className="muted small">Compare with:</span>
                  {result.benchmarks.map((b) => (
                    <Toggle
                      key={b.id}
                      label={
                        <>
                          <span className="dot" style={{ background: entityColor(c, b.id) }} aria-hidden="true" />
                          {b.label}
                        </>
                      }
                      checked={bench.includes(b.id)}
                      onChange={(v) => setBench(v ? [...bench, b.id] : bench.filter((x) => x !== b.id))}
                    />
                  ))}
                </div>
                <div className="table-wrap">
                  <table className="data stats">
                    <thead>
                      <tr>
                        <th />
                        {runs.map((r) => (
                          <th key={r.id} className="num">
                            <span className="dot" style={{ background: entityColor(c, r.id) }} aria-hidden="true" />
                            {r.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {STAT_ROWS.map((row) => (
                        <tr key={row.key}>
                          <th scope="row" title={row.hint}>
                            {row.label}
                          </th>
                          {runs.map((r) => {
                            const m = metricsOf(r);
                            return (
                              <td key={r.id} className={`num ${r.id === 'strategy' ? 'strong' : ''}`}>
                                {m && !(r.id === 'spx' && row.key === 'hitRate') ? row.fmt(m[row.key] as number) : '–'}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      {split !== 'oos' && split !== 'is' && (
                        <tr>
                          <th scope="row" title="Date range of the largest drawdown">Max DD period</th>
                          {runs.map((r) => (
                            <td key={r.id} className="num small muted">
                              {r.metrics.maxDrawdownStart} → {r.metrics.maxDrawdownTrough}
                            </td>
                          ))}
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="regime-share">
                  {REGIMES.map((r, i) => (
                    <span key={r} className="small">
                      <span className="dot" style={{ background: c.regime[i] }} aria-hidden="true" />
                      {r} {(result.regimeShare[i]! * 100).toFixed(1)}%
                    </span>
                  ))}
                  <span className="small muted">· avg regime spell {result.avgRegimeDays.toFixed(0)} trading days · {result.strategy.result.trades} trades</span>
                </div>
              </Card>

              <BootstrapCard result={result} paramsKey={JSON.stringify(params)} />
              <CostCard result={result} params={params} />

              <Card title="Growth of $1 (log scale)" actions={<button className="btn ghost" onClick={() => refs.equity.current?.toPNG('volstrat-equity')}>PNG</button>}>
                <Chart ref={refs.equity} option={charts.equity} height={380} group="bt" ariaLabel="Equity curves of the strategy and benchmarks, log scale" />
                <p className="muted small">Grey bands: the strategy held an asset whose return came from a proxy or synthetic series (see Methodology §2.7).</p>
              </Card>
              <Card title="Drawdown" actions={<button className="btn ghost" onClick={() => refs.dd.current?.toPNG('volstrat-drawdown')}>PNG</button>}>
                <Chart ref={refs.dd} option={charts.dd} height={240} group="bt" ariaLabel="Drawdowns of strategy and benchmarks" />
              </Card>
              <Card title="Allocation & score" actions={<button className="btn ghost" onClick={() => refs.alloc.current?.toPNG('volstrat-allocation')}>PNG</button>}>
                <Chart ref={refs.alloc} option={charts.alloc} height={340} group="bt" ariaLabel="Strategy weights over time stacked, with the composite score below" />
              </Card>
              <Card title="Rolling one-year return and Sharpe" actions={<button className="btn ghost" onClick={() => refs.roll.current?.toPNG('volstrat-rolling')}>PNG</button>}>
                <Chart ref={refs.roll} option={charts.roll} height={360} group="bt" ariaLabel="Rolling one-year returns and Sharpe ratios" />
              </Card>
              <Card title="Monthly returns – strategy" actions={<button className="btn ghost" onClick={() => refs.heat.current?.toPNG('volstrat-monthly')}>PNG</button>}>
                <Chart ref={refs.heat} option={charts.heat} height={charts.heatHeight} ariaLabel="Heatmap of monthly strategy returns by year" />
              </Card>
              <Robustness data={data} params={params} />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
