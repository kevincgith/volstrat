import { useEffect, useMemo, useRef, useState } from 'react';
import { Chart, type ChartHandle } from '../charts/Chart';
import { baseOption, line, regimeAreas, timeAxis, valueAxis, zoom } from '../charts/options';
import { colors } from '../charts/palette';
import { Card, ErrorBox, Loading, Segmented, Select } from '../components/ui';
import { COMPONENTS, COMPONENT_BY_ID } from '../engine/components';
import { loadVxCurves, type VxCurves } from '../engine/data';
import { rawFeature, standardise } from '../engine/score';
import { useData } from '../state/data';
import { useParams } from '../state/params';
import { useRun } from '../state/useRun';
import { useTheme } from '../theme';

const RANGES = [
  { value: 'all', label: 'All' },
  { value: '10y', label: '10Y' },
  { value: '5y', label: '5Y' },
  { value: '1y', label: '1Y' },
] as const;
type Range = (typeof RANGES)[number]['value'];

export default function Signals() {
  const { data, error } = useData();
  const [params] = useParams();
  const { result, error: runErr } = useRun(data, params);
  const { theme } = useTheme();
  const c = colors(theme);
  const [compId, setCompId] = useState('vix_term');
  const [range, setRange] = useState<Range>('10y');
  const chartRef = useRef<ChartHandle>(null);

  const comp = COMPONENT_BY_ID[compId]!;
  const compSeries = useMemo(() => {
    if (!data) return null;
    const raw = rawFeature(data, comp);
    const pct = standardise(raw, params.score);
    const setting = params.score.components[comp.id];
    const riskOffHigh = comp.riskOffWhenHigh !== (setting?.invert ?? false);
    return { raw, score: riskOffHigh ? pct.map((v) => 100 - v) : pct };
  }, [data, comp, params.score]);

  const option = useMemo(() => {
    if (!data || !result || !compSeries) return null;
    const n = data.dates.length;
    const yearsBack = range === 'all' ? 99 : parseInt(range, 10);
    const first = Math.max(0, n - 1 - yearsBack * 252);
    const startPct = (first / n) * 100;
    const dates = data.dates;
    const th = params.regime.thresholds;
    const g = (top: number, height: number) => ({ left: 56, right: 16, top, height });
    return {
      ...baseOption(c),
      legend: { show: false },
      axisPointer: { link: [{ xAxisIndex: 'all' }] },
      grid: [g(28, 170), g(236, 110), g(384, 100), g(522, 70)],
      xAxis: [0, 1, 2, 3].map((i) => timeAxis(c, dates, i, i === 3)),
      yAxis: [
        valueAxis(c, { type: 'log', gridIndex: 0, min: (v: { min: number }) => Math.floor(v.min * 0.9), max: (v: { max: number }) => Math.ceil(v.max * 1.05), name: 'S&P 500 (log)', nameTextStyle: { color: c.muted, align: 'left' } }),
        valueAxis(c, { gridIndex: 1, min: 0, max: 100, scale: false, interval: 25, name: 'Composite score', nameTextStyle: { color: c.muted, align: 'left' } }),
        valueAxis(c, { gridIndex: 2, name: `${comp.label} (${comp.unit})`, nameTextStyle: { color: c.muted, align: 'left' } }),
        valueAxis(c, { gridIndex: 3, min: 0, max: 100, scale: false, interval: 50, name: 'Component score', nameTextStyle: { color: c.muted, align: 'left' } }),
      ],
      dataZoom: zoom([0, 1, 2, 3], startPct),
      series: [
        { ...line('S&P 500', data.series.SPX!, c.series[0]!), xAxisIndex: 0, yAxisIndex: 0, markArea: regimeAreas(dates, result.regimes, c) },
        {
          ...line('Composite score', result.score.score, c.series[0]!),
          xAxisIndex: 1,
          yAxisIndex: 1,
          markArea: regimeAreas(dates, result.regimes, c),
          markLine: { silent: true, symbol: 'none', label: { show: false }, lineStyle: { color: c.axis, type: 'dashed', width: 1 }, data: th.map((y) => ({ yAxis: y })) },
        },
        { ...line(comp.label, compSeries.raw, c.series[1]!), xAxisIndex: 2, yAxisIndex: 2 },
        { ...line(`${comp.label} – score`, compSeries.score, c.series[1]!), xAxisIndex: 3, yAxisIndex: 3 },
      ],
    };
  }, [data, result, compSeries, comp, c, range, params.regime.thresholds]);

  if (error) return <ErrorBox message={error} />;
  if (runErr) return <ErrorBox message={`Engine error: ${runErr}`} />;
  if (!data || !result) return <Loading />;

  const meta = comp.inputs.map((k) => data.seriesMeta[k]).filter(Boolean);
  return (
    <section className="page">
      <div className="page-head">
        <h1>Signals</h1>
        <p className="muted">History of the composite and each component, on the S&amp;P 500 with regime shading (red = Risk-Off/Crisis, blue = Risk-On). Drag the slider or shift-scroll to zoom.</p>
      </div>
      <Card
        title="Signal history"
        actions={
          <>
            <Select label="Component" value={compId} onChange={setCompId} options={COMPONENTS.map((x) => ({ value: x.id, label: x.label }))} />
            <Segmented ariaLabel="Date range" value={range} onChange={setRange} options={RANGES.map((r) => ({ value: r.value, label: r.label }))} />
            <button className="btn ghost" onClick={() => chartRef.current?.toPNG(`volstrat-signals-${compId}`)}>
              PNG
            </button>
          </>
        }
      >
        {option && <Chart ref={chartRef} option={option} height={640} ariaLabel={`S&P 500, composite score and ${comp.label} over time`} />}
        <div className="comp-doc">
          <p>
            <strong>What:</strong> {comp.doc.what}
          </p>
          <p>
            <strong>Why it matters:</strong> {comp.doc.why}
          </p>
          <p>
            <strong>Typical range:</strong> {comp.doc.range} · <strong>Direction:</strong> {comp.riskOffWhenHigh ? 'high = risk-off' : 'low = risk-off'}
            {meta.length > 0 && (
              <>
                {' '}
                · <strong>Data:</strong> {meta.map((m) => `${m!.source} (${m!.first} →)`).join('; ')}
              </>
            )}
          </p>
        </div>
      </Card>
      <TermStructure />
    </section>
  );
}

function TermStructure() {
  const { data } = useData();
  const { theme } = useTheme();
  const c = colors(theme);
  const [vx, setVx] = useState<VxCurves | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [i, setI] = useState(-1);
  const [cmp, setCmp] = useState<'none' | '1m' | '1y'>('1m');
  const [playing, setPlaying] = useState(false);
  const chartRef = useRef<ChartHandle>(null);

  useEffect(() => {
    loadVxCurves(import.meta.env.BASE_URL)
      .then((v) => {
        setVx(v);
        setI(v.dates.length - 1);
      })
      .catch((e: unknown) => setErr(String(e)));
  }, []);

  useEffect(() => {
    if (!playing || !vx) return;
    const t = setInterval(() => {
      setI((x) => {
        if (x >= vx.dates.length - 1) {
          setPlaying(false);
          return x;
        }
        return Math.min(vx.dates.length - 1, x + 5);
      });
    }, 60);
    return () => clearInterval(t);
  }, [playing, vx]);

  const view = useMemo(() => {
    if (!vx || !data || i < 0) return null;
    const date = vx.dates[i]!;
    const di = data.dates.indexOf(date);
    const spot = di >= 0 ? data.series.VIX![di]! : NaN;
    const back = cmp === '1m' ? 21 : cmp === '1y' ? 252 : 0;
    const j = back ? Math.max(0, i - back) : -1;
    const cur = vx.curves[i]!;
    const prev = j >= 0 ? vx.curves[j]! : null;
    const prevSpot = j >= 0 ? data.series.VIX![data.dates.indexOf(vx.dates[j]!)] ?? NaN : NaN;
    const slope = cur.length > 1 ? cur[1]![1] / cur[0]![1] - 1 : NaN;
    return { date, spot, cur, prev, prevDate: j >= 0 ? vx.dates[j]! : '', prevSpot, slope };
  }, [vx, data, i, cmp]);

  const option = useMemo(() => {
    if (!view) return null;
    const pts = (curve: [number, number][], spot: number) => [...(Number.isFinite(spot) ? [[0, spot]] : []), ...curve];
    const allY = [...view.cur.map((p) => p[1]), view.spot, ...(view.prev ?? []).map((p) => p[1]), view.prevSpot].filter(Number.isFinite);
    const ymin = Math.floor(Math.min(...allY) - 1);
    const ymax = Math.ceil(Math.max(...allY) + 1);
    const series: unknown[] = [
      {
        name: view.date,
        type: 'line',
        data: pts(view.cur, view.spot),
        lineStyle: { width: 2, color: c.series[0] },
        itemStyle: { color: c.series[0], borderColor: c.surface, borderWidth: 2 },
        symbolSize: 8,
        label: { show: true, position: 'top', color: c.ink2, fontSize: 10, formatter: (p: { value: number[] }) => p.value[1]!.toFixed(1) },
      },
    ];
    if (view.prev) {
      series.push({
        name: view.prevDate,
        type: 'line',
        data: pts(view.prev, view.prevSpot),
        lineStyle: { width: 2, color: c.series[1], type: 'dashed' },
        itemStyle: { color: c.series[1], borderColor: c.surface, borderWidth: 2 },
        symbolSize: 8,
      });
    }
    return {
      ...baseOption(c),
      tooltip: { ...baseOption(c).tooltip, trigger: 'item', formatter: (p: { seriesName: string; value: number[] }) => `${p.seriesName}<br/>${p.value[0] === 0 ? 'Spot VIX' : `${p.value[0]} days to expiry`}: <b>${p.value[1]!.toFixed(2)}</b>` },
      grid: { left: 48, right: 24, top: 36, bottom: 40 },
      xAxis: valueAxis(c, { scale: false, min: 0, name: 'Days to expiry (0 = spot VIX)', nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: c.muted }, splitLine: { show: false } }),
      yAxis: valueAxis(c, { min: ymin, max: ymax, name: 'Vol pts', nameTextStyle: { color: c.muted } }),
      series,
    };
  }, [view, c]);

  if (err) return <ErrorBox message={err} />;
  if (!vx || !view) return <Loading label="Loading VIX futures curves…" />;
  const shape = !Number.isFinite(view.slope) ? '' : view.slope >= 0 ? 'contango' : 'backwardation';

  return (
    <Card
      title="VIX futures term structure"
      actions={
        <>
          <Segmented
            ariaLabel="Compare with"
            value={cmp}
            onChange={setCmp}
            options={[
              { value: 'none', label: 'No comparison' },
              { value: '1m', label: 'vs 1M ago' },
              { value: '1y', label: 'vs 1Y ago' },
            ]}
          />
          <button className="btn ghost" onClick={() => chartRef.current?.toPNG(`volstrat-vx-curve-${view.date}`)}>
            PNG
          </button>
        </>
      }
    >
      <div className="ts-controls">
        <button className="btn" onClick={() => (i >= vx.dates.length - 1 && !playing ? (setI(0), setPlaying(true)) : setPlaying(!playing))} aria-label={playing ? 'Pause animation' : 'Play animation through time'}>
          {playing ? '❚❚ Pause' : '▶ Play'}
        </button>
        <input type="range" min={0} max={vx.dates.length - 1} value={i} onChange={(e) => setI(+e.target.value)} aria-label="Curve date" className="grow" />
        <input type="date" value={view.date} min={vx.dates[0]} max={vx.dates.at(-1)} onChange={(e) => {
          const k = vx.dates.findIndex((d) => d >= e.target.value);
          if (k >= 0) setI(k);
        }} aria-label="Pick a date" />
      </div>
      <p className="small">
        <strong>{view.date}</strong> · spot VIX {Number.isFinite(view.spot) ? view.spot.toFixed(2) : '–'} · VX1 {view.cur[0]?.[1].toFixed(2)} ({view.cur[0]?.[0]}d) · VX2/VX1 − 1 ={' '}
        {Number.isFinite(view.slope) ? `${(view.slope * 100).toFixed(1)}%` : '–'} <span className={view.slope >= 0 ? 'muted' : 'warn'}>{shape}</span>
      </p>
      {option && <Chart ref={chartRef} option={option} height={320} ariaLabel={`VIX futures curve on ${view.date}`} />}
      <p className="muted small">
        Upward-sloping curve (contango) = calm: futures price higher volatility later than now. Downward-sloping (backwardation) = stress: near-term volatility is bid above longer-dated. Try 2008-10-24, 2018-02-05, 2020-03-16 or 2022-06-13.
      </p>
    </Card>
  );
}
