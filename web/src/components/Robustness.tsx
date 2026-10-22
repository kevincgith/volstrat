import { useMemo, useRef, useState } from 'react';
import { Chart, type ChartHandle } from '../charts/Chart';
import { baseOption, line, num, pct, timeAxis, valueAxis } from '../charts/options';
import { colors, entityColor } from '../charts/palette';
import type { MarketData } from '../engine/data';
import type { Metrics } from '../engine/metrics';
import type { Params } from '../engine/params';
import { AXES, expectedMaxSharpe, type AxisParam, type Objective } from '../engine/robustness';
import { downloadText, toCsv } from '../lib/csv';
import { runRobustness } from '../state/useRun';
import { useTheme } from '../theme';
import type { RobustnessResult } from '../workers/engine.worker';
import { Card, Select } from './ui';

const METRICS: { value: keyof Metrics; label: string; fmt: (v: number) => string; higherBetter: boolean }[] = [
  { value: 'sharpe', label: 'Sharpe', fmt: (v) => num(v), higherBetter: true },
  { value: 'cagr', label: 'CAGR', fmt: (v) => pct(v), higherBetter: true },
  { value: 'maxDrawdown', label: 'Max drawdown', fmt: (v) => pct(v, 0), higherBetter: true },
  { value: 'calmar', label: 'Calmar', fmt: (v) => num(v), higherBetter: true },
  { value: 'vol', label: 'Volatility', fmt: (v) => pct(v), higherBetter: false },
  { value: 'turnover', label: 'Turnover', fmt: (v) => `${num(v, 1)}x`, higherBetter: false },
];

export function Robustness({ data, params }: { data: MarketData; params: Params }) {
  const { theme } = useTheme();
  const c = colors(theme);
  const [x, setX] = useState<AxisParam>('smoothing');
  const [y, setY] = useState<AxisParam>('thresholdShift');
  const [metric, setMetric] = useState<keyof Metrics>('sharpe');
  const [objective, setObjective] = useState<Objective>('sharpe');
  const [trainYears, setTrainYears] = useState(5);
  const [testYears, setTestYears] = useState(1);
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const [res, setRes] = useState<{ result: RobustnessResult; ms: number; key: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const heatRef = useRef<ChartHandle>(null);
  const wfRef = useRef<ChartHandle>(null);

  const xs = AXES[x].values;
  const ys = AXES[y].values;
  const key = JSON.stringify([params, x, y, objective, trainYears, testYears]);
  const stale = res && res.key !== key;

  const go = async () => {
    setErr(null);
    setBusy({ done: 0, total: xs.length * ys.length });
    try {
      const out = await runRobustness(
        data,
        { params, x: { param: x, values: xs }, y: { param: y, values: ys }, objective, trainYears, testYears },
        (done, total) => setBusy({ done, total }),
      );
      setRes({ ...out, key });
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  };

  const mdef = METRICS.find((m) => m.value === metric)!;

  const heat = useMemo(() => {
    if (!res) return null;
    const r = res.result;
    const xv = [...new Set(r.cells.map((cl) => cl.x))];
    const yv = [...new Set(r.cells.map((cl) => cl.y))];
    const xa = AXES[x].fmt;
    const ya = AXES[y].fmt;
    const vals = r.cells.map((cl) => cl.metrics[metric] as number).filter(Number.isFinite);
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    return {
      ...baseOption(c),
      legend: { show: false },
      tooltip: {
        ...baseOption(c).tooltip,
        trigger: 'item',
        formatter: (p: { value: [number, number, number] }) => `${r.axisLabels.x}: <b>${xa(xv[p.value[0]]!)}</b><br/>${r.axisLabels.y}: <b>${ya(yv[p.value[1]]!)}</b><br/>${mdef.label}: <b>${mdef.fmt(p.value[2])}</b>`,
      },
      grid: { left: 70, right: 16, top: 8, bottom: 70 },
      xAxis: { type: 'category', data: xv.map(xa), name: r.axisLabels.x, nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: c.muted }, axisLabel: { color: c.muted }, axisLine: { show: false }, axisTick: { show: false } },
      yAxis: { type: 'category', data: yv.map(ya), name: r.axisLabels.y, nameLocation: 'middle', nameGap: 52, nameTextStyle: { color: c.muted }, axisLabel: { color: c.muted }, axisLine: { show: false }, axisTick: { show: false } },
      visualMap: {
        type: 'continuous',
        min: lo,
        max: hi,
        dimension: 2,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        itemHeight: 160,
        itemWidth: 10,
        textStyle: { color: c.muted },
        formatter: (v: number) => mdef.fmt(v),
        // one hue, light -> dark; darker = better on this metric
        inRange: { color: mdef.higherBetter ? ['#cde2fb', '#6da7ec', '#1c5cab'] : ['#1c5cab', '#6da7ec', '#cde2fb'] },
      },
      series: [
        {
          type: 'heatmap',
          data: r.cells.map((cl) => [xv.indexOf(cl.x), yv.indexOf(cl.y), cl.metrics[metric] as number]),
          itemStyle: { borderColor: c.surface, borderWidth: 2, borderRadius: 3 },
          label: { show: true, color: '#0b0b0b', fontSize: 11, formatter: (p: { value: [number, number, number] }) => mdef.fmt(p.value[2]) },
        },
      ],
    };
  }, [res, metric, c, x, y, mdef]);

  const wf = useMemo(() => {
    if (!res?.result.walkForward) return null;
    const w = res.result.walkForward;
    const dates = res.result.wfDates;
    const sl = (a: Float64Array) => Array.from(a).slice(w.start, w.end + 1);
    return {
      ...baseOption(c),
      grid: { left: 56, right: 16, top: 36, bottom: 28 },
      xAxis: timeAxis(c, dates),
      yAxis: valueAxis(c, { type: 'log', min: (v: { min: number }) => v.min * 0.97, max: (v: { max: number }) => v.max * 1.03 }),
      series: [line('Walk-forward (parameters re-chosen each period)', sl(w.nav), entityColor(c, 'strategy'))],
    };
  }, [res, c]);

  const nCells = xs.length * ys.length;
  const r = res?.result;
  const best = r ? r.cells.reduce((a, b) => ((b.metrics.sharpe ?? -Infinity) > (a.metrics.sharpe ?? -Infinity) ? b : a)) : null;
  const years = r?.base.years ?? 0;
  const emax = expectedMaxSharpe(nCells, years);
  const spread = r ? Math.max(...r.cells.map((cl) => cl.metrics.sharpe)) - Math.min(...r.cells.map((cl) => cl.metrics.sharpe)) : 0;

  const exportGrid = () => {
    if (!r) return;
    const rows = r.cells.map((cl) => [cl.x, cl.y, ...METRICS.map((m) => cl.metrics[m.value] as number)]);
    downloadText('volstrat-sensitivity.csv', toCsv([x, y, ...METRICS.map((m) => m.value)], rows));
  };

  return (
    <Card title="Robustness: parameter sensitivity and walk-forward">
      <p className="muted small" style={{ marginTop: 0 }}>
        Re-runs the backtest for every combination of two parameters (the rest stay as set on the left). A robust configuration sits on a broad plateau,
        not an isolated peak. Walk-forward re-selects the best cell on a trailing training window and applies it only to the following period, which tests
        whether parameter selection itself adds value out of sample.
      </p>
      <div className="robust-controls">
        <Select label="X axis" value={x} onChange={setX} options={Object.entries(AXES).map(([k, v]) => ({ value: k as AxisParam, label: v.label }))} />
        <Select label="Y axis" value={y} onChange={setY} options={Object.entries(AXES).filter(([k]) => k !== x).map(([k, v]) => ({ value: k as AxisParam, label: v.label }))} />
        <Select label="Heatmap metric" value={metric} onChange={setMetric} options={METRICS.map((m) => ({ value: m.value, label: m.label }))} />
        <Select label="Walk-forward objective" value={objective} onChange={setObjective} options={[{ value: 'sharpe', label: 'Sharpe' }, { value: 'sortino', label: 'Sortino' }, { value: 'calmar', label: 'Calmar' }, { value: 'cagr', label: 'CAGR' }]} />
        <Select label="Training window" value={trainYears} onChange={setTrainYears} options={[3, 5, 7, 10].map((v) => ({ value: v, label: `${v} years` }))} />
        <Select label="Test period" value={testYears} onChange={setTestYears} options={[0.5, 1, 2].map((v) => ({ value: v, label: v < 1 ? '6 months' : `${v} year${v > 1 ? 's' : ''}` }))} />
        <button className="btn primary" onClick={go} disabled={!!busy}>
          {busy ? `Running ${busy.done}/${busy.total}…` : `Run ${nCells} backtests`}
        </button>
      </div>
      {busy && (
        <div className="progress" role="progressbar" aria-valuenow={busy.done} aria-valuemax={busy.total}>
          <span style={{ width: `${(100 * busy.done) / Math.max(1, busy.total)}%` }} />
        </div>
      )}
      {err && <p className="warn small">{err}</p>}
      {stale && <p className="note small">Parameters changed since this run. Press Run to refresh.</p>}
      {r && heat && (
        <div className="robust-results">
          <div>
            <div className="card-head">
              <h2>{mdef.label} by parameter pair</h2>
              <div className="card-actions">
                <button className="btn ghost" onClick={exportGrid}>CSV</button>
                <button className="btn ghost" onClick={() => heatRef.current?.toPNG('volstrat-sensitivity')}>PNG</button>
              </div>
            </div>
            <Chart ref={heatRef} option={heat} height={Math.max(260, ys.length * 44 + 90)} ariaLabel={`Heatmap of ${mdef.label} across ${r.axisLabels.x} and ${r.axisLabels.y}`} />
            <p className="small">
              Current settings: {mdef.label} <b>{mdef.fmt(r.base[metric] as number)}</b>. Best Sharpe in grid <b>{num(best!.metrics.sharpe)}</b> ({AXES[x].fmt(best!.x)}, {AXES[y].fmt(best!.y)}); range across grid {num(spread)}.
              Computed in {(res!.ms / 1000).toFixed(1)} s.
            </p>
            <div className="callout small">
              <strong>Multiple-testing check.</strong> Picking the best of {nCells} configurations over {years.toFixed(1)} years inflates the in-sample Sharpe: even
              with zero skill, the expected best of {nCells} independent trials is about <b>+{num(emax)}</b> Sharpe above the truth (fewer effective trials here
              because neighbouring cells are correlated, but every parameter you have tried elsewhere counts too). Treat the gap between the best cell and a
              typical cell as noise unless it survives walk-forward.
            </div>
          </div>
          <div>
            <div className="card-head">
              <h2>Walk-forward ({trainYears}y train → {testYears < 1 ? '6m' : `${testYears}y`} test, by {objective})</h2>
              <div className="card-actions">
                <button className="btn ghost" onClick={() => wfRef.current?.toPNG('volstrat-walkforward')} disabled={!wf}>PNG</button>
              </div>
            </div>
            {r.walkForward && wf ? (
              <>
                <Chart ref={wfRef} option={wf} height={220} ariaLabel="Walk-forward out-of-sample equity curve" />
                <table className="data compact">
                  <thead>
                    <tr>
                      <th>Out-of-sample {r.walkForward.metrics.start} → {r.walkForward.metrics.end}</th>
                      <th className="num">CAGR</th>
                      <th className="num">Vol</th>
                      <th className="num">Sharpe</th>
                      <th className="num">Max DD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'Walk-forward selection', m: r.walkForward.metrics },
                      { label: 'Current fixed parameters', m: r.walkForward.baseMetrics },
                    ].map((row) => (
                      <tr key={row.label}>
                        <td>{row.label}</td>
                        <td className="num">{pct(row.m.cagr)}</td>
                        <td className="num">{pct(row.m.vol)}</td>
                        <td className="num">{num(row.m.sharpe)}</td>
                        <td className="num">{pct(row.m.maxDrawdown)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <details>
                  <summary className="small">Chosen parameters per period ({r.walkForward.periods.length})</summary>
                  <table className="data compact">
                    <thead>
                      <tr>
                        <th>Test period</th>
                        <th>{r.axisLabels.x}</th>
                        <th>{r.axisLabels.y}</th>
                        <th className="num">Train {objective}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.walkForward.periods.map((p) => {
                        const cell = r.cells[p.chosen]!;
                        return (
                          <tr key={p.testStart}>
                            <td>
                              {p.testStart} → {p.testEnd}
                            </td>
                            <td>{AXES[x].fmt(cell.x)}</td>
                            <td>{AXES[y].fmt(cell.y)}</td>
                            <td className="num">{num(p.trainObjective)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </details>
                <p className="muted small">
                  Note: the current fixed parameters were not chosen out of sample. If they were tuned by looking at this history, their row above is optimistic.
                </p>
              </>
            ) : (
              <p className="muted small">Not enough history after the training window. Shorten the training window or start earlier.</p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
