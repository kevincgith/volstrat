import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Chart } from '../charts/Chart';
import { baseOption, line, regimeAreas, timeAxis, valueAxis } from '../charts/options';
import { assetColor, colors } from '../charts/palette';
import { Card, ErrorBox, Loading, Toggle } from '../components/ui';
import { COMPONENT_BY_ID } from '../engine/components';
import { REGIMES } from '../engine/score';
import { addTradingDays } from '../engine/calendar';
import { OVERRIDE_REBOUND, OVERRIDE_REENTRY, rollingCorrelation } from '../engine/run';
import { TrackRecord } from '../components/TrackRecord';
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
  const { data, error, provisional, setProvisional, provisionalAvailable } = useData();
  const [params] = useParams();
  const { result, error: runErr } = useRun(data, params);
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
    const hedgeLb = params.allocation.adaptiveHedge?.lookback ?? 63;
    const sb = rollingCorrelation(result.assets.SPX!.returns, result.assets.IEF!.returns, hedgeLb)[L]!;
    // regime changes, most recent first, with the S&P 500 move during each spell
    const spells: { start: number; end: number; regime: number }[] = [];
    for (let t = 0; t <= L; t++) {
      const g = result.regimes[t]!;
      if (g < 0) continue;
      const last = spells.at(-1);
      if (last && last.regime === g && last.end === t - 1) last.end = t;
      else spells.push({ start: t, end: t, regime: g });
    }
    const spx = data.series.SPX!;
    const history = spells
      .slice(-12)
      .reverse()
      .map((sp, i, arr) => ({
        ...sp,
        from: arr[i + 1]?.regime ?? -1,
        score: result.score.score[sp.start]!,
        days: sp.end - sp.start + 1,
        spx: spx[sp.end]! / spx[sp.start]! - 1,
      }));
    // an override (panic rebound / recovery re-entry) can set a regime the score alone would not
    const ov = result.override[L]!;
    let override: null | { kind: number; scoreRegime: number; since: string; peak?: { date: string; ratio: number }; until: string; byDate: boolean; thr: number; normal: number; hold: number } = null;
    if (ov !== 0) {
      let s = L;
      while (s > 0 && result.override[s - 1] === ov) s--;
      const rb = params.regime.rebound ?? { peak: 1.1, lookback: 20, normal: 1, hold: 20, exit: 'days' as const };
      const vix = data.series.VIX!;
      const v3 = data.series.VIX3M!;
      let peak: { date: string; ratio: number } | undefined;
      if (ov === OVERRIDE_REBOUND) {
        for (let t = s; t >= Math.max(0, s - rb.lookback); t--) {
          const r = vix[t]! / v3[t]!;
          if (Number.isFinite(r) && r > rb.peak && (!peak || r > peak.ratio)) peak = { date: data.dates[t]!, ratio: r };
        }
      }
      // fixed-length lift: last day = start + hold - 1 trading days (projected over weekdays past the data)
      const byDate = ov === OVERRIDE_REBOUND && rb.exit !== 'signal';
      let until = '';
      if (byDate) {
        const end = s + rb.hold - 1;
        // past the data, count forward on the NYSE calendar
        until = end < data.dates.length ? data.dates[end]! : addTradingDays(data.dates.at(-1)!, end - (data.dates.length - 1));
      }
      override = { kind: ov, scoreRegime: result.scoreRegimes[L]!, since: data.dates[s]!, peak, until, byDate, thr: rb.peak, normal: rb.normal, hold: rb.hold };
    }
    return { L, regime, comps, wsum, weights, from, sb, hedgeLb, history, override };
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
  if (runErr) return <ErrorBox message={`Engine error: ${runErr}`} />;
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
          Signal as of the close of <strong>{date}</strong>
          {provisional && <span className="warn"> (provisional: some score inputs are not published yet and use their latest known values)</span>}. To be traded at the next close.{' '}
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
          {view.override && (
            <p className="small" style={{ marginTop: 6 }}>
              <span className="warn">
                Set by the {view.override.kind === OVERRIDE_REENTRY ? 'recovery re-entry rule' : 'panic-rebound override'} since {view.override.since};
                the score alone gives {REGIMES[view.override.scoreRegime]}.
              </span>{' '}
              <span className="muted">
                {view.override.kind === OVERRIDE_REENTRY
                  ? 'VIX is well off its recent peak, the VIX curve is back in contango and the S&P 500 is above its 20-day average (Methodology 15.5).'
                  : `VIX/VIX3M rose above ${view.override.thr.toFixed(2)}${view.override.peak ? ` (${view.override.peak.ratio.toFixed(3)} on ${view.override.peak.date})` : ''} and fell back below ${view.override.normal.toFixed(2)}: the panic has passed, and the rule re-enters rather than waiting for the score to recover (Methodology 15.2). `}
                {view.override.kind === OVERRIDE_REBOUND &&
                  (view.override.byDate
                    ? `It lasts ${view.override.hold} trading days, to ${view.override.until}, unless VIX/VIX3M goes back above ${view.override.thr.toFixed(2)}.`
                    : `It lasts until VIX/VIX3M is back at ${view.override.normal.toFixed(2)} or above, the S&P 500 breaks its recent low, or the score itself reaches the regime.`)}
              </span>
            </p>
          )}
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
          <p className="small" title="Trailing correlation of daily S&P 500 and 7-10y Treasury returns">
            Stock–bond correlation ({view.hedgeLb}d): <b>{Number.isFinite(view.sb) ? view.sb.toFixed(2) : '–'}</b>{' '}
            <span className="muted">
              {!Number.isFinite(view.sb) ? '' : view.sb < 0 ? '· Treasuries currently diversify equities' : '· Treasuries currently move with equities (weak hedge)'}
              {params.allocation.adaptiveHedge?.enabled ? ' · adaptive hedge on' : ''}
            </span>
          </p>
          <p className="muted small">
            {params.allocation.mode === 'regime' ? 'Regime portfolio' : params.allocation.mode === 'riskBudget' ? 'Risk budget (v5)' : 'Continuous mapping'} · rebalance{' '}
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

      <TrackRecord data={data} />

      <Card
        title="Recent regime changes"
        actions={
          <span className="small">
            <a href={`${import.meta.env.BASE_URL}data/feed.xml`} title="RSS feed of regime changes for the default (Growth) profile">
              RSS feed
            </a>{' '}
            · <a href={`${import.meta.env.BASE_URL}data/regime_history.json`}>full history (JSON)</a>
          </span>
        }
      >
        <div className="table-wrap">
          <table className="data compact">
            <thead>
              <tr>
                <th>Signal date</th>
                <th>Change</th>
                <th className="num">Score</th>
                <th className="num">Trading days</th>
                <th className="num">S&amp;P 500 during spell</th>
              </tr>
            </thead>
            <tbody>
              {view.history.map((h) => (
                <tr key={h.start}>
                  <td>{data.dates[h.start]}</td>
                  <td>
                    {h.from >= 0 && (
                      <>
                        <span className="dot" style={{ background: c.regime[h.from] }} aria-hidden="true" />
                        {REGIMES[h.from]} →{' '}
                      </>
                    )}
                    <span className="dot" style={{ background: c.regime[h.regime] }} aria-hidden="true" />
                    <strong>{REGIMES[h.regime]}</strong>
                    {h.end === view.L && <span className="muted small"> (current)</span>}
                  </td>
                  <td className="num">{h.score.toFixed(1)}</td>
                  <td className="num">{h.days}</td>
                  <td className="num">{`${(100 * h.spx).toFixed(1)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">
          Uses the parameters shown on this page. The RSS feed and the GitHub issue alerts track the default (Growth) profile: watch the repository on
          GitHub to be emailed when the daily update detects a regime change.
        </p>
      </Card>

      <Card title="Data status">
        {provisionalAvailable && (
          <div className="small" style={{ marginBottom: 8 }}>
            <Toggle
              label={`Use latest available data (${data.dates.at(-1) === data.meta.complete_through ? data.meta.provisional_through : data.dates.at(-1)}, provisional)`}
              checked={provisional}
              onChange={setProvisional}
              title="Compute the score for the newest date even though some score inputs are not published yet: they use their latest known values"
            />
            <span className="muted">
              {' '}
              Official date: {data.meta.complete_through}. The live track records, the RSS feed and the alerts always use the official date.
            </span>
          </div>
        )}
        <p className="small">
          Data through <strong>{provisional ? `${data.dates.at(-1)} (provisional)` : data.meta.last_date}</strong>
          {data.meta.eod_cutoff && (
            <span title="Prices dated after 18:00 New York time on the same day are treated as provisional and excluded">
              {' '}
              (end-of-day confirmed; cutoff {data.meta.eod_cutoff})
            </span>
          )}{' '}
          · built {data.meta.generated_at?.replace('T', ' ').slice(0, 16)} UTC ·{' '}
          {failing.length === 0 ? (
            <span className="ok">all sources OK</span>
          ) : (
            <span className="warn">
              {failing.length} source{failing.length > 1 ? 's' : ''} using cached data: {failing.map((s) => s.name).join(', ')}
            </span>
          )}
        </p>
        {data.meta.pending && Object.keys(data.meta.pending).length > 0 && (
          <p className="small">
            <span className="warn">
              Waiting for {data.meta.eod_cutoff}: {Object.keys(data.meta.pending).join(', ')}.
            </span>{' '}
            <span className="muted">
              A date becomes official, and is logged in the live records, only once every input has it; until then the official date stays{' '}
              {data.meta.complete_through}. Prices in, score inputs late: switch on <em>Use latest available data</em> above to see the newest date
              provisionally.
            </span>
          </p>
        )}
        {(() => {
          const rec = sources.filter((x) => (x.reconciled_days ?? 0) > 0);
          const revs = sources.flatMap((x) => (x.revisions ?? []).map((r) => ({ ...r, source: x.name })));
          return rec.length ? (
            <p className="small">
              Past-week reconciliation: last {rec[0]!.reconciled_days} business days re-downloaded from {rec.length} sources and compared with stored
              values —{' '}
              {(() => {
                const changed = revs.filter((r) => r.new !== null);
                const missing = revs.filter((r) => r.new === null);
                if (!revs.length) return <span className="ok">all matched</span>;
                return (
                  <>
                    {changed.length === 0 ? (
                      <span className="ok">no stored value changed</span>
                    ) : (
                      <span className="warn">
                        {changed.length} value{changed.length > 1 ? 's' : ''} revised:{' '}
                        {changed
                          .slice(0, 6)
                          .map((r) => `${r.source} ${r.column} ${r.date}: ${r.old} → ${r.new}`)
                          .join('; ')}
                        {changed.length > 6 ? ' …' : ''}
                      </span>
                    )}
                    {missing.length > 0 && (
                      <span className="muted">
                        {' '}
                        · {missing.length} stored day{missing.length > 1 ? 's' : ''} absent from the latest download (vendor gap; stored end-of-day
                        values kept)
                      </span>
                    )}
                  </>
                );
              })()}
            </p>
          ) : null;
        })()}
        {(() => {
          const checks = data.meta.checks ?? [];
          const bad = checks.filter((x) => !x.ok);
          return checks.length ? (
            <p className="small">
              Cross-source checks:{' '}
              {bad.length === 0 ? (
                <span className="ok">all {checks.length} passed</span>
              ) : (
                <span className="warn">
                  {bad.length} of {checks.length} flagged: {bad.map((x) => `${x.name} (${x.detail})`).join('; ')}
                </span>
              )}
            </p>
          ) : null;
        })()}
        <details>
          <summary className="small">Per-source detail and checks</summary>
          {(data.meta.checks ?? []).length > 0 && (
            <div className="table-wrap">
              <table className="data compact">
                <thead>
                  <tr>
                    <th>Cross-source check</th>
                    <th>Status</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {data.meta.checks!.map((x) => (
                    <tr key={x.name}>
                      <td>{x.name}</td>
                      <td>{x.ok ? <span className="ok">✓ OK</span> : <span className="warn">! check</span>}</td>
                      <td className="muted small">{x.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
