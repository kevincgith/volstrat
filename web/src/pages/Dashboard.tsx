import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Chart } from '../charts/Chart';
import { baseOption, line, regimeAreas, timeAxis, valueAxis } from '../charts/options';
import { assetColor, colors } from '../charts/palette';
import { Card, ErrorBox, Loading } from '../components/ui';
import { COMPONENT_BY_ID } from '../engine/components';
import { REGIMES } from '../engine/score';
import { useData } from '../state/data';
import { useParams } from '../state/params';
import { useRun } from '../state/useRun';
import { useTheme } from '../theme';

function lastFinite(x: ArrayLike<number>): number {
  for (let i = x.length - 1; i >= 0; i--) if (Number.isFinite(x[i]!)) return i;
  return -1;
}

function fmtRaw(v: number, unit: string) {
  if (!Number.isFinite(v)) return '–';
  const d = unit === 'ratio' ? 3 : Math.abs(v) < 10 ? 2 : 1;
  return v.toFixed(d);
}

export default function Dashboard() {
  const { data, error } = useData();
  const [params] = useParams();
  const { result } = useRun(data, params);
  const { theme } = useTheme();
  const c = colors(theme);
  const [search] = useSearchParams();
  const qs = search.toString() ? `?${search.toString()}` : '';

  const view = useMemo(() => {
    if (!data || !result) return null;
    const L = lastFinite(result.score.score);
    if (L < 0) return null;
    const regime = result.regimes[L]!;
    const comps = result.score.components
      .map((cr) => {
        const def = COMPONENT_BY_ID[cr.id]!;
        const w = params.score.components[cr.id]!.weight;
        return { def, raw: cr.raw[L]!, score: cr.score[L]!, w };
      })
      .sort((a, b) => b.w - a.w);
    const avail = comps.filter((x) => Number.isFinite(x.score));
    const wsum = avail.reduce((a, x) => a + x.w, 0);
    const weights = Object.entries(result.targets[L] ?? {})
      .filter(([, v]) => (v ?? 0) > 0)
      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
    const from = Math.max(0, L - 504);
    return { L, regime, comps, wsum, weights, from };
  }, [data, result, params]);

  const option = useMemo(() => {
    if (!data || !result || !view) return null;
    const dates = data.dates.slice(view.from, view.L + 1);
    const sc = result.score.score.slice(view.from, view.L + 1);
    const rg = result.regimes.slice(view.from, view.L + 1);
    const th = params.regime.thresholds;
    return {
      ...baseOption(c),
      legend: { show: false },
      grid: { left: 40, right: 16, top: 12, bottom: 28 },
      xAxis: timeAxis(c, dates),
      yAxis: valueAxis(c, { min: 0, max: 100, scale: false, interval: 20 }),
      series: [
        {
          ...line('Composite score', sc, c.series[0]!),
          markArea: regimeAreas(dates, rg, c),
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: c.axis, type: 'dashed', width: 1 },
            label: { show: false },
            data: th.map((y) => ({ yAxis: y })),
          },
        },
      ],
    };
  }, [data, result, view, c, params.regime.thresholds]);

  if (error) return <ErrorBox message={error} />;
  if (!data || !result) return <Loading />;
  if (!view) return <Loading label="Computing score…" />;

  const date = data.dates[view.L]!;
  const sources = Object.values(data.meta.sources ?? {});
  const failing = sources.filter((s) => !s.ok);

  return (
    <section className="page">
      <div className="page-head">
        <h1>Dashboard</h1>
        <p className="muted">
          Signal as of the close of <strong>{date}</strong>. To be traded at the next close.{' '}
          {qs && (
            <>
              Using your custom parameters (<Link to={`/backtest${qs}`}>edit</Link>).
            </>
          )}
        </p>
      </div>

      <div className="grid-3">
        <Card title="Risk-appetite score">
          <div className="hero">
            <div className="hero-value">{result.score.score[view.L]!.toFixed(1)}</div>
            <div className="hero-scale">
              <div className="scale-bar">
                <span className="scale-marker" style={{ left: `${result.score.score[view.L]}%` }} />
              </div>
              <div className="scale-labels">
                <span>0 risk-off</span>
                <span>100 risk-on</span>
              </div>
            </div>
          </div>
          <p className="muted small">
            Unsmoothed composite {result.score.composite[view.L]!.toFixed(1)} · {params.score.smoothing}-day EMA · coverage{' '}
            {(100 * result.score.coverage[view.L]!).toFixed(0)}% of enabled weight
          </p>
        </Card>

        <Card title="Current regime">
          <div className="regime-badge" style={{ borderColor: c.regime[view.regime], color: 'var(--text)' }}>
            <span className="dot" style={{ background: c.regime[view.regime] }} aria-hidden="true" />
            {REGIMES[view.regime]}
          </div>
          <ol className="regime-ladder">
            {[...REGIMES].reverse().map((r, i) => {
              const idx = REGIMES.length - 1 - i;
              const th = params.regime.thresholds;
              const lo = idx === 0 ? 0 : th[idx - 1];
              const hi = idx === 4 ? 100 : th[idx];
              return (
                <li key={r} className={idx === view.regime ? 'on' : ''}>
                  <span className="dot" style={{ background: c.regime[idx] }} aria-hidden="true" />
                  {r}
                  <span className="muted">
                    {lo}–{hi}
                  </span>
                </li>
              );
            })}
          </ol>
        </Card>

        <Card title="Recommended allocation">
          <ul className="alloc-list">
            {view.weights.map(([k, v]) => (
              <li key={k}>
                <span className="alloc-name">
                  <span className="dot" style={{ background: assetColor(c, k) }} aria-hidden="true" />
                  {data.assets[k]?.label ?? k}
                </span>
                <span className="alloc-bar">
                  <span style={{ width: `${(v ?? 0) * 100}%`, background: assetColor(c, k) }} />
                </span>
                <span className="num">{((v ?? 0) * 100).toFixed(0)}%</span>
              </li>
            ))}
          </ul>
          <p className="muted small">
            {params.allocation.mode === 'regime' ? 'Regime portfolio' : 'Continuous mapping'} · rebalance{' '}
            {params.backtest.rebalance === 'regime' ? 'on regime change' : params.backtest.rebalance}
          </p>
        </Card>
      </div>

      <Card title="Score – last two years" actions={<span className="muted small">shading = regime; dashed = cut-offs</span>}>
        {option && <Chart option={option} height={240} ariaLabel="Composite risk-appetite score over the last two years with regime shading" />}
      </Card>

      <Card title="Component breakdown">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Component</th>
                <th className="num">Value</th>
                <th>Score (0 risk-off · 100 risk-on)</th>
                <th className="num">Weight</th>
                <th className="num">Contribution</th>
              </tr>
            </thead>
            <tbody>
              {view.comps.map((x) => {
                const ok = Number.isFinite(x.score);
                return (
                  <tr key={x.def.id} className={ok ? '' : 'dim'}>
                    <td>
                      <span title={x.def.doc.what}>{x.def.label}</span>
                    </td>
                    <td className="num">
                      {fmtRaw(x.raw, x.def.unit)} <span className="muted small">{x.def.unit}</span>
                    </td>
                    <td>
                      {ok ? (
                        <span className="score-cell">
                          <span className="score-bar">
                            <span style={{ width: `${x.score}%`, background: c.regime[Math.min(4, Math.floor(x.score / 20))] }} />
                          </span>
                          <span className="num">{x.score.toFixed(0)}</span>
                        </span>
                      ) : (
                        <span className="muted small">not enough history / no data</span>
                      )}
                    </td>
                    <td className="num">{x.w.toFixed(2)}</td>
                    <td className="num">{ok && view.wsum > 0 ? ((x.w * x.score) / view.wsum).toFixed(1) : '–'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Data status">
        <p className="small">
          Data through <strong>{data.meta.last_date}</strong> · built {data.meta.generated_at?.replace('T', ' ').slice(0, 16)} UTC ·{' '}
          {failing.length === 0 ? (
            <span className="ok">all sources OK</span>
          ) : (
            <span className="warn">
              {failing.length} source{failing.length > 1 ? 's' : ''} using cached data: {failing.map((s) => s.name).join(', ')}
            </span>
          )}
        </p>
        <details>
          <summary className="small">Per-source detail</summary>
          <div className="table-wrap">
            <table className="data compact">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Last observation</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {sources
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((s) => (
                    <tr key={s.name}>
                      <td>{s.name}</td>
                      <td>{s.ok ? <span className="ok">✓ OK</span> : <span className="warn">! {s.required ? 'failed' : 'cached'}</span>}</td>
                      <td>{s.last_date ?? '–'}</td>
                      <td className="muted small">{[s.message, ...(s.warnings ?? [])].filter(Boolean).join('; ').slice(0, 140)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </details>
      </Card>
    </section>
  );
}
