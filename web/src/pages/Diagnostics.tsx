import { useMemo, useRef, useState } from 'react';
import { Chart, type ChartHandle } from '../charts/Chart';
import { baseOption, num, pct, valueAxis } from '../charts/options';
import { colors } from '../charts/palette';
import { assetLabel } from '../components/ParamPanel';
import { Card, ErrorBox, Loading, Segmented, Select } from '../components/ui';
import type { Attribution } from '../engine/attribution';
import { STRATEGY_ASSETS } from '../engine/assets';
import { COMPONENT_BY_ID } from '../engine/components';
import { conditionalReturns, informationCoefficient, scoreBuckets } from '../engine/diagnostics';
import { REGIMES } from '../engine/score';
import { downloadText, toCsv } from '../lib/csv';
import { useData } from '../state/data';
import { useParams } from '../state/params';
import { runAttribution, useRun } from '../state/useRun';
import { useTheme } from '../theme';

const BUCKETS = ['0–20', '20–40', '40–60', '60–80', '80–100'];

export default function Diagnostics() {
  const { data, error } = useData();
  const [params] = useParams();
  const { result, error: runErr } = useRun(data, params);
  const { theme } = useTheme();
  const c = colors(theme);
  const [asset, setAsset] = useState<string>('SPX');
  const [by, setBy] = useState<'regime' | 'bucket'>('regime');
  const [horizon, setHorizon] = useState(63);
  const retRef = useRef<ChartHandle>(null);
  const tailRef = useRef<ChartHandle>(null);

  const diag = useMemo(() => {
    if (!data || !result) return null;
    const score = result.score.score;
    let from = 0;
    while (from < score.length && !Number.isFinite(score[from]!)) from++;
    const to = data.dates.length - 1;
    const labels = by === 'regime' ? result.regimes : scoreBuckets(score);
    const r = result.assets[asset]!.returns;
    const lag = params.backtest.lag;
    return {
      cond: conditionalReturns(labels, r, 5, lag, from, to, horizon),
      ic21: informationCoefficient(score, r, lag, from, to, 21),
      ic63: informationCoefficient(score, r, lag, from, to, 63),
      from,
      to,
    };
  }, [data, result, asset, by, horizon, params.backtest.lag]);

  const names = by === 'regime' ? [...REGIMES] : BUCKETS.map((b) => `Score ${b}`);

  const charts = useMemo(() => {
    if (!diag) return null;
    const g = diag.cond.groups;
    const bar = (vals: number[], label: string, fmt: (v: number) => string) => ({
      ...baseOption(c),
      legend: { show: false },
      tooltip: { ...baseOption(c).tooltip, trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v: number) => fmt(v) },
      grid: { left: 56, right: 16, top: 16, bottom: 40 },
      xAxis: { type: 'category', data: names, axisLabel: { color: c.muted, interval: 0 }, axisLine: { lineStyle: { color: c.axis } }, axisTick: { show: false } },
      yAxis: valueAxis(c, { scale: false, axisLabel: { color: c.muted, formatter: (v: number) => fmt(v) } }),
      series: [
        {
          name: label,
          type: 'bar',
          barMaxWidth: 48,
          data: vals.map((v, i) => ({ value: Number.isFinite(v) ? v : null, itemStyle: { color: c.regime[i], borderRadius: v >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4] } })),
          label: { show: true, position: 'top', color: c.ink2, fontSize: 11, formatter: (p: { value: number }) => fmt(p.value) },
        },
      ],
    });
    return {
      ret: bar(g.map((x) => x.annReturn), 'Annualised return', (v) => pct(v, 0)),
      tail: bar(g.map((x) => x.fwdTail), `Share of ${horizon}-day windows losing >10%`, (v) => pct(v, 0)),
    };
  }, [diag, c, names, horizon]);

  if (error) return <ErrorBox message={error} />;
  if (runErr) return <ErrorBox message={`Engine error: ${runErr}`} />;
  if (!data || !result || !diag || !charts) return <Loading />;

  const ic = (x: typeof diag.ic21) =>
    Number.isFinite(x.ic) ? (
      <>
        <b>{num(x.ic)}</b> <span className="muted small">t = {num(x.tStat, 1)}, n = {x.n}</span>
      </>
    ) : (
      '–'
    );

  const exportCond = () =>
    downloadText(
      `volstrat-diagnostics-${asset}-${by}.csv`,
      toCsv(
        ['group', 'days', 'share', 'ann_return', 'vol', 'sharpe', 'up_days', 'worst_day', `fwd_${horizon}d_mean`, `fwd_${horizon}d_loss_gt_10pct`],
        diag.cond.groups.map((g, i) => [names[i]!, g.days, g.share, g.annReturn, g.vol, g.sharpe, g.upDays, g.worstDay, g.fwdMean, g.fwdTail]),
      ),
    );

  return (
    <section className="page">
      <div className="page-head">
        <h1>Diagnostics</h1>
        <p className="muted">
          Does the signal separate good from bad environments, independently of which portfolio you attach to it? Each day's signal (known at the close)
          is paired with the asset's returns from the first day it could be traded (t+{params.backtest.lag + 1}). Period {data.dates[diag.from]} →{' '}
          {data.dates[diag.to]}, current parameters.
        </p>
      </div>

      <Card
        title="Asset behaviour after each signal state"
        actions={
          <>
            <Select label="Asset" value={asset} onChange={setAsset} options={STRATEGY_ASSETS.map((k) => ({ value: k, label: assetLabel(k) }))} />
            <Segmented
              ariaLabel="Group by"
              value={by}
              onChange={setBy}
              options={[
                { value: 'regime', label: 'By regime' },
                { value: 'bucket', label: 'By score bucket' },
              ]}
            />
            <Segmented
              ariaLabel="Forward horizon"
              value={String(horizon) as '21' | '63' | '126'}
              onChange={(v) => setHorizon(+v)}
              options={[
                { value: '21', label: '1M' },
                { value: '63', label: '3M' },
                { value: '126', label: '6M' },
              ]}
            />
            <button className="btn ghost" onClick={exportCond}>
              CSV
            </button>
          </>
        }
      >
        <Reading groups={diag.cond.groups} names={names} ic={diag.ic21} horizon={horizon} asset={assetLabel(asset)} />
        <div className="ic-row">
          <span>
            Information coefficient (Spearman, score vs next 1M return): {ic(diag.ic21)}
          </span>
          <span>
            vs next 3M return: {ic(diag.ic63)}
          </span>
          <span className="muted small">Positive = higher score precedes higher returns. Non-overlapping samples; |t| &gt; 2 ≈ significant.</span>
        </div>
        <div className="table-wrap">
          <table className="data stats">
            <thead>
              <tr>
                <th>{by === 'regime' ? 'Regime' : 'Score'}</th>
                <th className="num">Share of days</th>
                <th className="num">Ann. return</th>
                <th className="num">Volatility</th>
                <th className="num">Sharpe</th>
                <th className="num">Up days</th>
                <th className="num">Worst day</th>
                <th className="num">Avg next {horizon}d</th>
                <th className="num">P(next {horizon}d &lt; −10%)</th>
              </tr>
            </thead>
            <tbody>
              {diag.cond.groups.map((g, i) => (
                <tr key={i} className={g.days ? '' : 'dim'}>
                  <th scope="row">
                    <span className="dot" style={{ background: c.regime[i] }} aria-hidden="true" />
                    {names[i]}
                  </th>
                  <td className="num">{pct(g.share, 1)}</td>
                  <td className="num">{pct(g.annReturn)}</td>
                  <td className="num">{pct(g.vol)}</td>
                  <td className="num strong">{num(g.sharpe)}</td>
                  <td className="num">{pct(g.upDays, 0)}</td>
                  <td className="num">{pct(g.worstDay)}</td>
                  <td className="num">{pct(g.fwdMean)}</td>
                  <td className="num">{pct(g.fwdTail, 1)}</td>
                </tr>
              ))}
              <tr>
                <th scope="row">All days</th>
                <td className="num">100%</td>
                <td className="num">{pct(diag.cond.all.annReturn)}</td>
                <td className="num">{pct(diag.cond.all.vol)}</td>
                <td className="num">{num(diag.cond.all.sharpe)}</td>
                <td className="num">{pct(diag.cond.all.upDays, 0)}</td>
                <td className="num">{pct(diag.cond.all.worstDay)}</td>
                <td className="num">{pct(diag.cond.all.fwdMean)}</td>
                <td className="num">{pct(diag.cond.all.fwdTail, 1)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="grid-2">
          <div>
            <div className="card-head">
              <h2>{assetLabel(asset)}: annualised return</h2>
              <div className="card-actions">
                <button className="btn ghost" onClick={() => retRef.current?.toPNG(`volstrat-diag-return-${asset}`)}>PNG</button>
              </div>
            </div>
            <Chart ref={retRef} option={charts.ret} height={240} ariaLabel={`${assetLabel(asset)} annualised return by signal state`} />
          </div>
          <div>
            <div className="card-head">
              <h2>{assetLabel(asset)}: chance of a &gt;10% loss over the next {horizon} days</h2>
              <div className="card-actions">
                <button className="btn ghost" onClick={() => tailRef.current?.toPNG(`volstrat-diag-tail-${asset}`)}>PNG</button>
              </div>
            </div>
            <Chart ref={tailRef} option={charts.tail} height={240} ariaLabel={`${assetLabel(asset)} probability of a large loss by signal state`} />
          </div>
        </div>
        <p className="muted small">
          Daily statistics use each day once. Forward-window statistics use overlapping windows, so adjacent days are not independent. Pick a defensive
          asset (Treasuries, gold, T-bills) to see how good a hedge it has been in each regime — that is how the Risk-Off portfolio should be judged.
        </p>
      </Card>

      <AttributionCard />
    </section>
  );
}

/** Plain-English reading of the conditional table: does the signal sort risk, return, or both? */
function Reading({
  groups,
  names,
  ic,
  horizon,
  asset,
}: {
  groups: ReturnType<typeof conditionalReturns>['groups'];
  names: string[];
  ic: ReturnType<typeof informationCoefficient>;
  horizon: number;
  asset: string;
}) {
  const valid = groups.map((g, i) => ({ g, i })).filter((x) => x.g.days >= 60);
  if (valid.length < 2) return null;
  const lo = valid[0]!;
  const hi = valid[valid.length - 1]!;
  const volRatio = lo.g.vol / hi.g.vol;
  const sharpes = valid.map((x) => x.g.sharpe);
  const sRange = Math.max(...sharpes) - Math.min(...sharpes);
  const riskSorted = volRatio > 1.5 && lo.g.fwdTail > hi.g.fwdTail;
  const returnSorted = Number.isFinite(ic.tStat) && ic.tStat > 2;
  const verdict = returnSorted
    ? 'The score also ranks future returns (significant positive IC), so it times returns as well as risk.'
    : riskSorted
      ? 'The score sorts risk much better than return: volatility and tail-loss odds fall steadily from the stressed to the calm states, while risk-adjusted returns are similar. Its value is in sizing risk (as volatility targeting does), not in forecasting returns.'
      : 'The separation between states is weak for this asset.';
  return (
    <div className="callout small">
      <strong>Reading.</strong> {asset} volatility after <i>{names[lo.i]}</i> days was {num(volRatio, 1)}× that after <i>{names[hi.i]}</i> days (
      {pct(lo.g.vol, 0)} vs {pct(hi.g.vol, 0)}); the chance of a &gt;10% loss over the next {horizon} days was {pct(lo.g.fwdTail, 1)} vs {pct(hi.g.fwdTail, 1)}.
      Sharpe ratios span {num(Math.min(...sharpes))}–{num(Math.max(...sharpes))} (range {num(sRange)}). {verdict}
    </div>
  );
}

function AttributionCard() {
  const { data } = useData();
  const [params] = useParams();
  const { theme } = useTheme();
  const c = colors(theme);
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const [res, setRes] = useState<{ result: Attribution; key: string; ms: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const chartRef = useRef<ChartHandle>(null);
  const key = JSON.stringify(params);

  const go = async () => {
    if (!data) return;
    setErr(null);
    setBusy({ done: 0, total: 1 });
    try {
      const out = await runAttribution(data, params, (done, total) => setBusy({ done, total }));
      setRes({ ...out, key });
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  };

  const option = useMemo(() => {
    if (!res) return null;
    const rows = [...res.result.rows].sort((a, b) => b.without.sharpe - a.without.sharpe);
    // contribution = base Sharpe - Sharpe without the component (positive = it helps)
    const contrib = rows.map((r) => res.result.base.sharpe - r.without.sharpe);
    return {
      ...baseOption(c),
      legend: { show: false },
      tooltip: { ...baseOption(c).tooltip, trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v: number) => (v >= 0 ? '+' : '') + num(v) },
      grid: { left: 230, right: 48, top: 8, bottom: 28 },
      xAxis: valueAxis(c, { scale: false, axisLabel: { color: c.muted, formatter: (v: number) => num(v) } }),
      yAxis: { type: 'category', data: rows.map((r) => COMPONENT_BY_ID[r.id]?.label ?? r.id), axisLabel: { color: c.ink2 }, axisLine: { show: false }, axisTick: { show: false } },
      series: [
        {
          type: 'bar',
          name: 'Sharpe contribution',
          barMaxWidth: 18,
          data: contrib.map((v) => ({ value: v, itemStyle: { color: v >= 0 ? c.pos : c.neg, borderRadius: v >= 0 ? [0, 4, 4, 0] : [4, 0, 0, 4] } })),
          label: { show: true, position: 'right', color: c.ink2, fontSize: 11, formatter: (p: { value: number }) => (p.value >= 0 ? '+' : '') + num(p.value) },
        },
      ],
    };
  }, [res, c]);

  return (
    <Card
      title="Component attribution (leave-one-out)"
      actions={
        <button className="btn primary" onClick={go} disabled={!!busy || !data}>
          {busy ? `Running ${busy.done}/${busy.total}…` : res ? 'Re-run' : 'Run attribution'}
        </button>
      }
    >
      <p className="muted small" style={{ marginTop: 0 }}>
        Re-runs the backtest without each enabled component (the others' weights rescale) and with each component alone. Contribution = Sharpe with all
        components − Sharpe without this one; positive means the component earns its place.
      </p>
      {busy && (
        <div className="progress" role="progressbar" aria-valuenow={busy.done} aria-valuemax={busy.total}>
          <span style={{ width: `${(100 * busy.done) / Math.max(1, busy.total)}%` }} />
        </div>
      )}
      {err && <p className="warn small">{err}</p>}
      {res && res.key !== key && <p className="note small">Parameters changed since this run. Press Re-run to refresh.</p>}
      {res && option && (
        <>
          <Chart ref={chartRef} option={option} height={Math.max(160, res.result.rows.length * 30 + 40)} ariaLabel="Sharpe contribution of each component" />
          <div className="table-wrap">
            <table className="data stats">
              <thead>
                <tr>
                  <th>Component</th>
                  <th className="num">Sharpe without</th>
                  <th className="num">CAGR without</th>
                  <th className="num">Max DD without</th>
                  <th className="num">Sharpe alone</th>
                  <th className="num">Max DD alone</th>
                  <th className="num">Alone from</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">All enabled components</th>
                  <td className="num strong">{num(res.result.base.sharpe)}</td>
                  <td className="num">{pct(res.result.base.cagr)}</td>
                  <td className="num">{pct(res.result.base.maxDrawdown)}</td>
                  <td className="num">–</td>
                  <td className="num">–</td>
                  <td className="num">{res.result.base.start}</td>
                </tr>
                {res.result.rows.map((r) => (
                  <tr key={r.id}>
                    <th scope="row">{COMPONENT_BY_ID[r.id]?.label ?? r.id}</th>
                    <td className="num">{num(r.without.sharpe)}</td>
                    <td className="num">{pct(r.without.cagr)}</td>
                    <td className="num">{pct(r.without.maxDrawdown)}</td>
                    <td className="num">{num(r.alone.sharpe)}</td>
                    <td className="num">{pct(r.alone.maxDrawdown)}</td>
                    <td className="num small muted">{r.alone.start}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small">
            Computed in {(res.ms / 1000).toFixed(1)} s. Leave-one-out understates the value of components that are redundant with each other (removing one
            of two correlated signals barely matters) — compare with the "alone" column. Don't prune components on this basis alone: that is another round of
            fitting to the same history.
          </p>
        </>
      )}
    </Card>
  );
}
