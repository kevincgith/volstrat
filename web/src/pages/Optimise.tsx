import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chart, type ChartHandle } from '../charts/Chart';
import { baseOption, line, num, pct, timeAxis, valueAxis, zoom } from '../charts/options';
import { assetColor, colors, entityColor } from '../charts/palette';
import { assetLabel } from '../components/ParamPanel';
import { Card, DateInput, ErrorBox, Loading, Select, Toggle } from '../components/ui';
import type { Weights } from '../engine/allocation';
import { STRATEGY_ASSETS, type AssetKey } from '../engine/assets';
import { COMPONENT_BY_ID } from '../engine/components';
import type { Metrics } from '../engine/metrics';
import type { AllocationOptimisation, AllocObjective, AllocOptions, WeightObjective, WeightOptimisation, WeightWalkForward } from '../engine/optimise';
import { merge } from '../engine/params';
import { REGIMES } from '../engine/score';
import { useData } from '../state/data';
import { useParams } from '../state/params';
import { runJob } from '../state/useRun';
import { useTheme } from '../theme';

const ROWS: { key: keyof Metrics; label: string; fmt: (v: number) => string }[] = [
  { key: 'cagr', label: 'CAGR', fmt: (v) => pct(v) },
  { key: 'vol', label: 'Volatility', fmt: (v) => pct(v) },
  { key: 'sharpe', label: 'Sharpe', fmt: (v) => num(v) },
  { key: 'maxDrawdown', label: 'Max drawdown', fmt: (v) => pct(v) },
  { key: 'calmar', label: 'Calmar', fmt: (v) => num(v) },
  { key: 'turnover', label: 'Turnover (p.a.)', fmt: (v) => `${num(v, 1)}x` },
  { key: 'costDrag', label: 'Cost drag (p.a.)', fmt: (v) => pct(v, 2) },
];

function MetricsTable({ cols }: { cols: { label: string; m: Metrics | undefined; strong?: boolean }[] }) {
  return (
    <div className="table-wrap">
      <table className="data stats">
        <thead>
          <tr>
            <th />
            {cols.map((c) => (
              <th key={c.label} className="num">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.key}>
              <th scope="row">{r.label}</th>
              {cols.map((c) => (
                <td key={c.label} className={`num ${c.strong ? 'strong' : ''}`}>
                  {c.m ? r.fmt(c.m[r.key] as number) : '–'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function fmtWeights(w: Weights) {
  return Object.entries(w)
    .filter(([, v]) => (v ?? 0) > 0.001)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .map(([k, v]) => `${assetLabel(k)} ${Math.round((v ?? 0) * 100)}%`)
    .join(', ');
}

export default function Optimise() {
  const { data, error } = useData();
  if (error) return <ErrorBox message={error} />;
  if (!data) return <Loading />;
  return (
    <section className="page">
      <div className="page-head">
        <h1>Optimise</h1>
        <p className="muted">
          Search for better regime portfolios and signal weights — and test whether the improvement survives out of sample. Every optimiser result is shown
          next to an honest benchmark: walk-forward re-fitting for allocations, an untouched test period for signal weights. Costs (as set on the{' '}
          <Link to="/backtest">Backtest</Link> page) are charged in every evaluation.
        </p>
      </div>
      <div className="callout small">
        <strong>Read this first.</strong> An optimiser run on one history always finds a configuration that looks better on that history. The in-sample
        column is therefore an upper bound, not an expectation. Trust a change only if the out-of-sample column improves too, and prefer robust settings
        (heavy mean shrinkage, position caps, few distinct weight values) over the in-sample optimum.
      </div>
      <AllocationOptimiser />
      <WeightOptimiser />
    </section>
  );
}

function AllocationOptimiser() {
  const { data } = useData();
  const [params, setParams] = useParams();
  const { theme } = useTheme();
  const c = colors(theme);
  const [universe, setUniverse] = useState<AssetKey[]>(['SPX', 'SSO', 'IEF', 'TLT', 'GLD', 'XLU', 'SHY', 'BIL']);
  const [objective, setObjective] = useState<AllocObjective>('utility');
  const [gamma, setGamma] = useState(3);
  const [minObs, setMinObs] = useState(250);
  const [maxWeight, setMaxWeight] = useState(0.6);
  const [meanShrink, setMeanShrink] = useState(0.5);
  const [volCap, setVolCap] = useState(0.12);
  const [minTrain, setMinTrain] = useState(5);
  const [refit, setRefit] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<{ r: AllocationOptimisation; ms: number; key: string } | null>(null);
  const chartRef = useRef<ChartHandle>(null);
  const key = JSON.stringify([params, universe, objective, gamma, minObs, maxWeight, meanShrink, volCap, minTrain, refit]);

  const go = async () => {
    if (!data) return;
    setBusy(true);
    setErr(null);
    const opt: AllocOptions = { universe, objective, riskAversion: gamma, maxWeight, meanShrink, covShrink: 0.1, volCap, minObs };
    try {
      const out = await runJob(data, { type: 'optAlloc', id: 0, params, opt, wf: { minTrainYears: minTrain, refitYears: refit } }, 'optAlloc');
      setRes({ r: out.result, ms: out.ms, key });
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  const option = useMemo(() => {
    const o = res?.r.oos;
    if (!o) return null;
    const series = [
      { name: 'Current portfolios', nav: o.navCurrent, color: entityColor(c, 'strategy') },
      { name: 'Walk-forward optimised (out-of-sample)', nav: o.navWalkForward, color: c.series[2]! },
      { name: 'Full-sample optimised (in-sample, look-ahead)', nav: o.navInSample, color: c.muted },
    ];
    return {
      ...baseOption(c),
      legend: { ...baseOption(c).legend, data: series.map((s) => s.name) },
      grid: { left: 56, right: 16, top: 36, bottom: 48 },
      xAxis: timeAxis(c, o.dates),
      yAxis: valueAxis(c, { type: 'log', min: (v: { min: number }) => v.min * 0.97, max: (v: { max: number }) => v.max * 1.03 }),
      dataZoom: zoom(0),
      series: series.map((s) => line(s.name, s.nav, s.color, s.color === c.muted ? { lineStyle: { width: 1.5, color: s.color, type: 'dashed' } } : {})),
    };
  }, [res, c]);

  const apply = () => {
    if (!res) return;
    const ports = res.r.inSample.map((s) => s.weights) as Params5;
    setParams(merge(params, { allocation: { mode: 'regime', regimePortfolios: ports } }));
  };

  return (
    <Card
      title="1 · What to hold in each regime"
      actions={
        <button className="btn primary" onClick={go} disabled={busy}>
          {busy ? 'Optimising…' : res ? 'Re-run' : 'Optimise allocation'}
        </button>
      }
    >
      <p className="muted small" style={{ marginTop: 0 }}>
        For each regime, the optimiser estimates the mean and covariance of each asset's return (above T-bills) on the days <em>after</em> that regime
        was signalled, then solves a long-only portfolio, by default maximising expected excess return minus γ/2 × variance. Means are noisy, so they are shrunk toward the cross-asset average; positions are capped.
        Walk-forward re-fits every {refit < 1 ? '6 months' : `${refit} year${refit > 1 ? 's' : ''}`} using only data available at that date.
      </p>
      <div className="universe">
        <span className="muted small">Universe:</span>
        {STRATEGY_ASSETS.filter((k) => k !== 'WORLD').map((k) => (
          <Toggle key={k} label={assetLabel(k)} checked={universe.includes(k)} onChange={(v) => setUniverse(v ? [...universe, k] : universe.filter((x) => x !== k))} />
        ))}
      </div>
      <div className="robust-controls">
        <Select
          label="Objective per regime"
          value={objective}
          onChange={setObjective}
          options={[
            { value: 'utility', label: 'Return − risk penalty (default)' },
            { value: 'maxReturnVolCap', label: 'Max return under vol cap' },
            { value: 'minVariance', label: 'Min variance' },
            { value: 'maxSharpe', label: 'Max Sharpe (favours short bonds)' },
          ]}
        />
        {objective === 'utility' && (
          <Select
            label="Risk aversion γ"
            value={gamma}
            onChange={setGamma}
            options={[1, 2, 3, 5, 8].map((v) => ({ value: v, label: `${v}${v === 3 ? ' (default)' : v === 1 ? ' (aggressive)' : v === 8 ? ' (defensive)' : ''}` }))}
          />
        )}
        <Select label="Max weight per asset" value={maxWeight} onChange={setMaxWeight} options={[0.4, 0.6, 0.8, 1].map((v) => ({ value: v, label: pct(v, 0) }))} />
        <Select
          label="Mean shrinkage"
          value={meanShrink}
          onChange={setMeanShrink}
          options={[0, 0.25, 0.5, 0.75, 0.9].map((v) => ({ value: v, label: `${pct(v, 0)}${v === 0.5 ? ' (default)' : v === 0 ? ' (raw means)' : ''}` }))}
        />
        {objective === 'maxReturnVolCap' && <Select label="Vol cap" value={volCap} onChange={setVolCap} options={[0.06, 0.08, 0.1, 0.12, 0.15, 0.2].map((v) => ({ value: v, label: pct(v, 0) }))} />}
        <Select
          label="Min days per regime"
          value={minObs}
          onChange={setMinObs}
          options={[120, 250, 500].map((v) => ({ value: v, label: `${v}${v === 250 ? ' (default)' : ''}` }))}
        />
        <Select label="Min training history" value={minTrain} onChange={setMinTrain} options={[3, 5, 7, 10].map((v) => ({ value: v, label: `${v} years` }))} />
        <Select label="Re-fit every" value={refit} onChange={setRefit} options={[0.5, 1, 2].map((v) => ({ value: v, label: v < 1 ? '6 months' : `${v} year${v > 1 ? 's' : ''}` }))} />
      </div>
      {params.allocation.adaptiveHedge?.enabled && <p className="note small">The adaptive hedge applies to “Current portfolios” only; optimised portfolios are evaluated without it.</p>}
      {err && <p className="warn small">{err}</p>}
      {res && res.key !== key && <p className="note small">Settings changed since this run. Press Re-run to refresh.</p>}
      {res && (
        <>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Regime</th>
                  <th>Current portfolio</th>
                  <th>Optimised (fitted {res.r.trainFrom} → {res.r.trainTo})</th>
                  <th className="num">Days</th>
                  <th className="num">Est. excess return</th>
                  <th className="num">Est. vol</th>
                </tr>
              </thead>
              <tbody>
                {[...res.r.inSample].reverse().map((s) => (
                  <tr key={s.regime}>
                    <th scope="row">
                      <span className="dot" style={{ background: c.regime[s.regime] }} aria-hidden="true" />
                      {REGIMES[s.regime]}
                    </th>
                    <td className="small">{fmtWeights(params.allocation.regimePortfolios[s.regime]!)}</td>
                    <td className="small">
                      <span className="weight-chips">
                        {Object.entries(s.weights)
                          .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
                          .map(([k, v]) => (
                            <span key={k} className="weight-chip">
                              <span className="dot" style={{ background: assetColor(c, k) }} aria-hidden="true" />
                              {assetLabel(k)} {Math.round((v ?? 0) * 100)}%
                            </span>
                          ))}
                        {s.kept && <span className="muted"> (fewer than {minObs} days – current portfolio kept)</span>}
                      </span>
                    </td>
                    <td className="num">{s.n}</td>
                    <td className="num">{pct(s.expReturn)}</td>
                    <td className="num">{pct(s.expVol)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {res.r.oos ? (
            <>
              <h3 className="sub">
                Out-of-sample test {res.r.oos.from} → {res.r.oos.to}
              </h3>
              <MetricsTable
                cols={[
                  { label: 'Current portfolios', m: res.r.oos.current },
                  { label: 'Walk-forward optimised', m: res.r.oos.walkForward, strong: true },
                  { label: 'Full-sample optimised (look-ahead)', m: res.r.oos.inSampleFixed },
                ]}
              />
              <div className="card-head" style={{ marginTop: 12 }}>
                <h2>Growth of $1 over the test window</h2>
                <div className="card-actions">
                  <button className="btn ghost" onClick={() => chartRef.current?.toPNG('volstrat-optimised-allocation')}>
                    PNG
                  </button>
                </div>
              </div>
              {option && <Chart ref={chartRef} option={option} height={300} ariaLabel="Equity curves: current, walk-forward optimised and in-sample optimised portfolios" />}
              <div className="callout small">
                <strong>Reading.</strong> Walk-forward Sharpe {num(res.r.oos.walkForward.sharpe)} vs current {num(res.r.oos.current.sharpe)}; the full-sample
                optimum ({num(res.r.oos.inSampleFixed.sharpe)}) used information from the future and is not achievable.{' '}
                {res.r.oos.walkForward.sharpe > res.r.oos.current.sharpe + 0.05
                  ? 'Optimisation added value out of sample here.'
                  : res.r.oos.walkForward.sharpe < res.r.oos.current.sharpe - 0.05
                    ? 'Optimisation hurt out of sample: the hand-picked portfolios were more robust.'
                    : 'Out of sample, optimisation made little difference.'}
              </div>
              <details>
                <summary className="small">Walk-forward re-fits ({res.r.oos.refits.length})</summary>
                <div className="table-wrap">
                  <table className="data compact">
                    <thead>
                      <tr>
                        <th>Re-fit date</th>
                        {[...REGIMES].reverse().map((r) => (
                          <th key={r}>{r}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {res.r.oos.refits.map((f) => (
                        <tr key={f.date}>
                          <td>{f.date}</td>
                          {[...f.portfolios].reverse().map((w, i) => (
                            <td key={i} className="small">
                              {fmtWeights(w)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          ) : (
            <p className="muted small">Not enough history for a walk-forward test with this training length.</p>
          )}
          <div className="toolbar" style={{ marginTop: 12 }}>
            <span className="muted small">Computed in {(res.ms / 1000).toFixed(1)} s.</span>
            <span className="grow" />
            <button className="btn" onClick={apply}>
              Apply full-sample portfolios to Backtest
            </button>
          </div>
        </>
      )}
    </Card>
  );
}

type Params5 = [Weights, Weights, Weights, Weights, Weights];

function WeightOptimiser() {
  const { data } = useData();
  const [params, setParams] = useParams();
  const { theme } = useTheme();
  const c = colors(theme);
  const [objective, setObjective] = useState<WeightObjective>('sharpe');
  const [trainEnd, setTrainEnd] = useState('2016-12-31');
  const [grid, setGrid] = useState('0,0.5,1,2');
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<{ r: WeightOptimisation; ms: number; key: string } | null>(null);
  const key = JSON.stringify([params, objective, trainEnd, grid]);
  const values = grid.split(',').map(Number);

  const go = async () => {
    if (!data) return;
    setBusy({ done: 0, total: 1 });
    setErr(null);
    try {
      const out = await runJob(
        data,
        { type: 'optWeights', id: 0, params, objective, trainEnd, values, maxPasses: 3 },
        'optWeights',
        (done, total) => setBusy({ done, total }),
      );
      setRes({ r: out.result, ms: out.ms, key });
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  };

  const apply = () => {
    if (!res) return;
    setParams(
      merge(params, {
        score: { components: Object.fromEntries(res.r.ids.map((id) => [id, { weight: res.r.optimised[id]!, enabled: res.r.optimised[id]! > 0 }])) },
      }),
    );
  };

  return (
    <Card
      title="2 · Signal component weights"
      actions={
        <button className="btn primary" onClick={go} disabled={!!busy}>
          {busy ? `Searching ${busy.done}/${busy.total}…` : res ? 'Re-run' : 'Optimise weights'}
        </button>
      }
    >
      <p className="muted small" style={{ marginTop: 0 }}>
        Coordinate descent over the weights of the enabled components: each pass tries every candidate weight for every component and keeps changes that
        improve the objective <strong>on the training period only</strong> (up to 3 passes). The test period after the training cut-off is never seen by
        the search. Current allocation, costs and other settings are held fixed.
      </p>
      <div className="robust-controls">
        <Select
          label="Objective"
          value={objective}
          onChange={setObjective}
          options={[
            { value: 'sharpe', label: 'Sharpe' },
            { value: 'sortino', label: 'Sortino' },
            { value: 'calmar', label: 'Calmar' },
            { value: 'cagr', label: 'CAGR' },
          ]}
        />
        <DateInput label="Training ends" value={trainEnd} onChange={setTrainEnd} />
        <Select
          label="Candidate weights"
          value={grid}
          onChange={setGrid}
          options={[
            { value: '0,1', label: 'On / off (0, 1)' },
            { value: '0,0.5,1,2', label: '0, 0.5, 1, 2' },
            { value: '0,0.25,0.5,1,1.5,2,3', label: 'Fine (7 values)' },
          ]}
        />
      </div>
      {err && <p className="warn small">{err}</p>}
      {busy && (
        <div className="progress" role="progressbar" aria-valuenow={busy.done} aria-valuemax={busy.total}>
          <span style={{ width: `${(100 * busy.done) / Math.max(1, busy.total)}%` }} />
        </div>
      )}
      {res && res.key !== key && <p className="note small">Settings changed since this run. Press Re-run to refresh.</p>}
      {res && (
        <>
          <div className="table-wrap">
            <table className="data compact">
              <thead>
                <tr>
                  <th>Component</th>
                  <th className="num">Current weight</th>
                  <th className="num">Optimised weight</th>
                </tr>
              </thead>
              <tbody>
                {res.r.ids.map((id) => {
                  const a = res.r.current[id]!;
                  const b = res.r.optimised[id]!;
                  return (
                    <tr key={id}>
                      <th scope="row">{COMPONENT_BY_ID[id]?.label ?? id}</th>
                      <td className="num">{num(a)}</td>
                      <td className={`num ${a !== b ? 'strong' : ''}`} style={a !== b ? { color: b > a ? c.pos : c.neg } : undefined}>
                        {num(b)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="grid-2">
            <div>
              <h3 className="sub">
                Training (in-sample) {res.r.trainFrom} → {res.r.trainTo}
              </h3>
              <MetricsTable
                cols={[
                  { label: 'Current', m: res.r.train.current },
                  { label: 'Equal weights', m: res.r.train.equal },
                  { label: 'Optimised', m: res.r.train.optimised, strong: true },
                ]}
              />
            </div>
            <div>
              <h3 className="sub">
                Test (out-of-sample) {res.r.testFrom} → {res.r.testTo}
              </h3>
              {res.r.test ? (
                <MetricsTable
                  cols={[
                    { label: 'Current', m: res.r.test.current },
                    { label: 'Equal weights', m: res.r.test.equal },
                    { label: 'Optimised', m: res.r.test.optimised, strong: true },
                  ]}
                />
              ) : (
                <p className="muted small">The training period runs to the end of the data, so there is no test period.</p>
              )}
            </div>
          </div>
          {res.r.test && (
            <div className="callout small">
              <strong>Reading.</strong> In-sample the search raised {WF_LABEL[objective]} from {num(res.r.train.current[objective])} to{' '}
              {num(res.r.train.optimised[objective])}; on the unseen test period it went from {num(res.r.test.current[objective])} to{' '}
              {num(res.r.test.optimised[objective])} (equal weights: {num(res.r.test.equal[objective])}).{' '}
              {res.r.test.optimised[objective] > res.r.test.current[objective] + 0.05
                ? 'The improvement partly survived out of sample.'
                : 'The in-sample gain did not carry over — a typical sign of overfitting. Simple weights are the more robust choice.'}{' '}
              {res.r.evaluations} backtests were evaluated, so the in-sample figure is the best of {res.r.evaluations} tries.
            </div>
          )}
          <div className="toolbar" style={{ marginTop: 12 }}>
            <span className="muted small">Computed in {(res.ms / 1000).toFixed(1)} s.</span>
            <span className="grow" />
            <button className="btn" onClick={apply}>
              Apply optimised weights to Backtest
            </button>
          </div>
        </>
      )}
      <WeightWalkForwardPanel objective={objective} firstTest={trainEnd} values={values} />
    </Card>
  );
}

const WF_LABEL: Record<WeightObjective, string> = { sharpe: 'Sharpe', sortino: 'Sortino', calmar: 'Calmar', cagr: 'CAGR' };

function WeightWalkForwardPanel({ objective, firstTest, values }: { objective: WeightObjective; firstTest: string; values: number[] }) {
  const { data } = useData();
  const [params] = useParams();
  const { theme } = useTheme();
  const c = colors(theme);
  const [refit, setRefit] = useState(1);
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<{ r: WeightWalkForward | null; ms: number; key: string } | null>(null);
  const chartRef = useRef<ChartHandle>(null);
  const key = JSON.stringify([params, objective, firstTest, values, refit]);

  const go = async () => {
    if (!data) return;
    setBusy({ done: 0, total: 1 });
    setErr(null);
    try {
      const out = await runJob(
        data,
        { type: 'wfWeights', id: 0, params, objective, firstTest, refitYears: refit, values, maxPasses: 2 },
        'wfWeights',
        (done, total) => setBusy({ done, total }),
      );
      setRes({ r: out.result, ms: out.ms, key });
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  };

  const option = useMemo(() => {
    const r = res?.r;
    if (!r) return null;
    const series = [
      { name: 'Walk-forward re-optimised weights', nav: r.nav.walkForward, color: c.series[2]! },
      { name: 'Current fixed weights', nav: r.nav.current, color: entityColor(c, 'strategy') },
      { name: 'Equal weights', nav: r.nav.equal, color: c.muted },
    ];
    return {
      ...baseOption(c),
      legend: { ...baseOption(c).legend, data: series.map((x) => x.name) },
      grid: { left: 56, right: 16, top: 36, bottom: 48 },
      xAxis: timeAxis(c, r.dates),
      yAxis: valueAxis(c, { type: 'log', min: (v: { min: number }) => v.min * 0.97, max: (v: { max: number }) => v.max * 1.03 }),
      dataZoom: zoom(0),
      series: series.map((x) => line(x.name, x.nav, x.color, x.color === c.muted ? { lineStyle: { width: 1.5, color: x.color, type: 'dashed' } } : {})),
    };
  }, [res, c]);

  const r = res?.r;
  return (
    <div className="wf-panel">
      <div className="card-head">
        <h2>Walk-forward re-optimisation (out-of-sample)</h2>
        <div className="card-actions">
          <Select
            label="Re-optimise every"
            value={refit}
            onChange={setRefit}
            options={[1, 2, 3].map((v) => ({ value: v, label: `${v} year${v > 1 ? 's' : ''}` }))}
          />
          <button className="btn primary" onClick={go} disabled={!!busy}>
            {busy ? `Re-fit ${busy.done}/${busy.total}…` : res ? 'Re-run' : 'Run walk-forward'}
          </button>
        </div>
      </div>
      <p className="muted small" style={{ marginTop: 0 }}>
        Starting at the training cut-off ({firstTest}), the weight search is re-run every {refit} year{refit > 1 ? 's' : ''} on all data up to that
        date only, and the winning weights are used until the next re-fit. The stitched result is fully out of sample, which is the realistic test of
        &ldquo;optimise the weights periodically&rdquo;.
      </p>
      {err && <p className="warn small">{err}</p>}
      {busy && (
        <div className="progress" role="progressbar" aria-valuenow={busy.done} aria-valuemax={busy.total}>
          <span style={{ width: `${(100 * busy.done) / Math.max(1, busy.total)}%` }} />
        </div>
      )}
      {res && res.key !== key && <p className="note small">Settings changed since this run. Press Re-run to refresh.</p>}
      {res && !r && <p className="muted small">Not enough data before or after the cut-off for a walk-forward test.</p>}
      {r && (
        <>
          <MetricsTable
            cols={[
              { label: 'Walk-forward re-optimised', m: r.metrics.walkForward, strong: true },
              { label: 'Current fixed weights', m: r.metrics.current },
              { label: 'Equal weights', m: r.metrics.equal },
            ]}
          />
          {option && <Chart ref={chartRef} option={option} height={280} ariaLabel="Walk-forward re-optimised weights versus fixed and equal weights" />}
          <div className="callout small">
            <strong>Reading.</strong> Out of sample ({r.dates[0]} → {r.dates.at(-1)}), re-optimising the weights every {refit} year
            {refit > 1 ? 's' : ''} gave {WF_LABEL[objective]} {num(r.metrics.walkForward[objective])}, versus {num(r.metrics.current[objective])} for the
            current fixed weights and {num(r.metrics.equal[objective])} for equal weights.{' '}
            {r.metrics.walkForward[objective] > Math.max(r.metrics.current[objective], r.metrics.equal[objective]) + 0.05
              ? 'Periodic re-optimisation added value.'
              : 'Periodic re-optimisation did not beat simple fixed weights.'}{' '}
            {r.evaluations} backtests in {(res!.ms / 1000).toFixed(1)} s.
          </div>
          <details>
            <summary className="small">Weights chosen at each re-fit ({r.periods.length})</summary>
            <div className="table-wrap">
              <table className="data compact">
                <thead>
                  <tr>
                    <th>Applied</th>
                    {Object.keys(r.periods[0]!.weights).map((id) => (
                      <th key={id} className="num" title={COMPONENT_BY_ID[id]?.label}>
                        {COMPONENT_BY_ID[id]?.label.split(' (')[0] ?? id}
                      </th>
                    ))}
                    <th className="num">Train {WF_LABEL[objective]}</th>
                  </tr>
                </thead>
                <tbody>
                  {r.periods.map((p) => (
                    <tr key={p.from}>
                      <td>
                        {p.from} → {p.to}
                      </td>
                      {Object.values(p.weights).map((w, i) => (
                        <td key={i} className="num">
                          {num(w, 2)}
                        </td>
                      ))}
                      <td className="num">{num(p.trainObjective)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
