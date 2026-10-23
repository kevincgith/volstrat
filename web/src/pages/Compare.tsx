import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chart, type ChartHandle } from '../charts/Chart';
import { baseOption, line, num, pct, timeAxis, valueAxis, zoom } from '../charts/options';
import { colors } from '../charts/palette';
import { Card, DateInput, ErrorBox, Loading, Toggle } from '../components/ui';
import { equityExposure } from '../engine/allocation';
import { drawdown } from '../engine/metrics';
import { decodeParams, encodeParams, merge, PRESETS, presetParams, type Params } from '../engine/params';
import { REGIMES } from '../engine/score';
import { downloadText, toCsv } from '../lib/csv';
import { useData } from '../state/data';
import { useParams } from '../state/params';
import { useRuns } from '../state/useRun';
import { useTheme } from '../theme';

interface Profile {
  id: string;
  name: string;
  encoded: string; // encodeParams() output
  builtin?: boolean;
}

const KEY = 'volstrat.profiles';
const BUILTIN: Profile[] = PRESETS.map((p) => ({ id: `preset:${p.id}`, name: p.label, encoded: encodeParams(presetParams(p.id)), builtin: true }));

function loadSaved(): Profile[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as Profile[]) : [];
    return Array.isArray(list) ? list.filter((p) => p && typeof p.name === 'string' && typeof p.encoded === 'string') : [];
  } catch {
    return [];
  }
}

function saveAll(list: Profile[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // storage unavailable: profiles last for this page view only
  }
}

const ROWS: { key: string; label: string; fmt: (v: number) => string }[] = [
  { key: 'cagr', label: 'CAGR', fmt: (v) => pct(v) },
  { key: 'vol', label: 'Volatility', fmt: (v) => pct(v) },
  { key: 'sharpe', label: 'Sharpe', fmt: (v) => num(v) },
  { key: 'sortino', label: 'Sortino', fmt: (v) => num(v) },
  { key: 'maxDrawdown', label: 'Max drawdown', fmt: (v) => pct(v) },
  { key: 'calmar', label: 'Calmar', fmt: (v) => num(v) },
  { key: 'ulcer', label: 'Ulcer index', fmt: (v) => num(v, 1) },
  { key: 'beta', label: 'Beta to S&P 500', fmt: (v) => num(v) },
  { key: 'upCapture', label: 'Upside capture', fmt: (v) => pct(v, 0) },
  { key: 'downCapture', label: 'Downside capture', fmt: (v) => pct(v, 0) },
  { key: 'worstYear', label: 'Worst calendar year', fmt: (v) => pct(v) },
  { key: 'turnover', label: 'Turnover (p.a.)', fmt: (v) => `${num(v, 1)}x` },
];

export default function Compare() {
  const { data, error } = useData();
  const [current] = useParams();
  const { theme } = useTheme();
  const c = colors(theme);
  const [saved, setSaved] = useState<Profile[]>(loadSaved);
  const [name, setName] = useState('');
  const [start, setStart] = useState('2007-01-01');
  const [selected, setSelected] = useState<string[]>(['current', 'preset:growth', 'preset:balanced', 'preset:conservative']);
  const eqRef = useRef<ChartHandle>(null);
  const ddRef = useRef<ChartHandle>(null);

  const all: Profile[] = useMemo(() => [{ id: 'current', name: 'Current (Backtest page)', encoded: encodeParams(current) }, ...BUILTIN, ...saved], [current, saved]);
  const chosen = all.filter((p) => selected.includes(p.id)).slice(0, 7);
  const paramsList: Params[] = useMemo(() => chosen.map((p) => merge(decodeParams(p.encoded), { period: { start, end: '', oosStart: '' } })), [chosen, start]);
  const { results, running } = useRuns(data, paramsList);

  const ready = results.length === chosen.length && results.every(Boolean) && !running;

  const charts = useMemo(() => {
    if (!data || !ready) return null;
    // common window: latest start across profiles
    const s = Math.max(...results.map((r) => r!.start));
    const e = Math.min(...results.map((r) => r!.end));
    const dates = data.dates.slice(s, e + 1);
    const spx = results[0]!.benchmarks.find((b) => b.id === 'spx')!.result.nav;
    const rebase = (nav: Float64Array) => Array.from(nav.slice(s, e + 1), (v) => v / nav[s]!);
    const series = [
      ...chosen.map((p, i) => ({ name: p.name, nav: rebase(results[i]!.strategy.result.nav), color: c.series[i % 8]! })),
      { name: 'S&P 500', nav: rebase(spx), color: c.muted },
    ];
    const legend = { ...baseOption(c).legend, data: series.map((x) => x.name) };
    const eq = {
      ...baseOption(c),
      legend,
      grid: { left: 56, right: 16, top: 36, bottom: 48 },
      xAxis: timeAxis(c, dates),
      yAxis: valueAxis(c, { type: 'log', min: (v: { min: number }) => v.min * 0.95, max: (v: { max: number }) => v.max * 1.05 }),
      dataZoom: zoom(0),
      series: series.map((x) => line(x.name, x.nav, x.color, x.name === 'S&P 500' ? { lineStyle: { width: 1.5, color: x.color, type: 'dashed' } } : {})),
    };
    const dd = {
      ...baseOption(c),
      legend,
      grid: { left: 56, right: 16, top: 36, bottom: 28 },
      xAxis: timeAxis(c, dates),
      yAxis: valueAxis(c, { scale: false, max: 0, axisLabel: { color: c.muted, formatter: (v: number) => `${(v * 100).toFixed(0)}%` } }),
      tooltip: { ...baseOption(c).tooltip, valueFormatter: (v: number) => pct(v) },
      series: series.map((x) => {
        const nav = Float64Array.from(x.nav);
        return line(x.name, drawdown(nav, 0, nav.length - 1), x.color, x.name === 'S&P 500' ? { lineStyle: { width: 1.5, color: x.color, type: 'dashed' } } : {});
      }),
    };
    return { eq, dd, s, e };
  }, [data, ready, results, chosen, c]);

  if (error) return <ErrorBox message={error} />;
  if (!data) return <Loading />;

  const toggle = (id: string, on: boolean) => setSelected(on ? [...selected, id] : selected.filter((x) => x !== id));
  const saveCurrent = () => {
    const n = name.trim() || `Profile ${saved.length + 1}`;
    const next = [...saved, { id: `saved:${Date.now()}`, name: n, encoded: encodeParams(current) }];
    setSaved(next);
    saveAll(next);
    setSelected([...selected, next.at(-1)!.id]);
    setName('');
  };
  const remove = (id: string) => {
    const next = saved.filter((p) => p.id !== id);
    setSaved(next);
    saveAll(next);
    setSelected(selected.filter((x) => x !== id));
  };
  const exportProfiles = () => downloadText('volstrat-profiles.json', JSON.stringify(saved, null, 2), 'application/json');
  const importProfiles = (file: File) =>
    file.text().then((t) => {
      try {
        const list = JSON.parse(t) as Profile[];
        if (!Array.isArray(list)) return;
        const clean = list.filter((p) => typeof p?.name === 'string' && typeof p?.encoded === 'string').map((p, i) => ({ id: `saved:${Date.now()}-${i}`, name: p.name.slice(0, 60), encoded: p.encoded }));
        const next = [...saved, ...clean];
        setSaved(next);
        saveAll(next);
      } catch {
        // ignore malformed files
      }
    });

  const exportStats = () => {
    if (!ready) return;
    downloadText(
      'volstrat-compare.csv',
      toCsv(['metric', ...chosen.map((p) => p.name)], ROWS.map((r) => [r.label, ...results.map((x) => (x!.strategy.metrics as unknown as Record<string, number>)[r.key])])),
    );
  };

  return (
    <section className="page">
      <div className="page-head">
        <h1>Compare</h1>
        <p className="muted">
          Run several parameter profiles side by side over a common period. Save the configuration currently on the <Link to="/backtest">Backtest</Link> page as a
          named profile; saved profiles stay in this browser and can be exported or imported as a file.
        </p>
      </div>
      <div className="grid-compare">
        <Card title="Profiles">
          <ul className="profile-list">
            {all.map((p) => (
              <li key={p.id}>
                <Toggle label={p.name} checked={selected.includes(p.id)} onChange={(v) => toggle(p.id, v)} />
                <span className="grow" />
                <Link className="small" to={`/backtest${p.encoded ? `?p=${p.encoded}` : ''}`}>
                  open
                </Link>
                {!p.builtin && p.id !== 'current' && (
                  <button className="btn ghost tiny" aria-label={`Delete ${p.name}`} onClick={() => remove(p.id)}>
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
          <div className="save-row">
            <input placeholder="Name for current settings" value={name} onChange={(e) => setName(e.target.value)} aria-label="Profile name" />
            <button className="btn primary" onClick={saveCurrent}>
              Save
            </button>
          </div>
          <div className="save-row">
            <button className="btn" onClick={exportProfiles} disabled={!saved.length}>
              Export
            </button>
            <label className="btn">
              Import
              <input type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importProfiles(e.target.files[0])} />
            </label>
          </div>
          <DateInput label="Common start date" value={start} onChange={setStart} />
          <p className="muted small">Up to 7 profiles. The window starts at the latest start across the selected profiles.</p>
        </Card>
        <div className="bt-main">
          {!ready || !charts ? (
            <Loading label={chosen.length ? 'Running profiles…' : 'Select at least one profile'} />
          ) : (
            <>
              <Card title={`Statistics ${data.dates[charts.s]} → ${data.dates[charts.e]}`} actions={<button className="btn ghost" onClick={exportStats}>CSV</button>}>
                <div className="table-wrap">
                  <table className="data stats">
                    <thead>
                      <tr>
                        <th />
                        {chosen.map((p, i) => (
                          <th key={p.id} className="num">
                            <span className="dot" style={{ background: c.series[i % 8] }} aria-hidden="true" />
                            {p.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ROWS.map((row) => (
                        <tr key={row.key}>
                          <th scope="row">{row.label}</th>
                          {results.map((r, i) => (
                            <td key={i} className="num">
                              {row.fmt((r!.strategy.metrics as unknown as Record<string, number>)[row.key]!)}
                            </td>
                          ))}
                        </tr>
                      ))}
                      <tr>
                        <th scope="row">Avg equity exposure</th>
                        {results.map((r, i) => {
                          let s = 0;
                          let n = 0;
                          const w = r!.strategy.result.weights;
                          for (let t = r!.start; t <= r!.end; t++) {
                            const wt: Record<string, number> = {};
                            for (const k of Object.keys(w)) wt[k] = w[k]![t] || 0;
                            s += equityExposure(wt);
                            n++;
                          }
                          return (
                            <td key={i} className="num">
                              {pct(s / n, 0)}
                            </td>
                          );
                        })}
                      </tr>
                      <tr>
                        <th scope="row">Time in Crisis / Risk-Off</th>
                        {results.map((r, i) => (
                          <td key={i} className="num">
                            {pct(r!.regimeShare[0]! + r!.regimeShare[1]!, 0)}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="muted small">Regimes: {REGIMES.join(' · ')}. Equity exposure counts leveraged ETFs at their leverage.</p>
              </Card>
              <Card title="Growth of $1 (log scale, rebased to common start)" actions={<button className="btn ghost" onClick={() => eqRef.current?.toPNG('volstrat-compare-equity')}>PNG</button>}>
                <Chart ref={eqRef} option={charts.eq} height={360} group="cmp" ariaLabel="Equity curves of the selected profiles" />
              </Card>
              <Card title="Drawdown" actions={<button className="btn ghost" onClick={() => ddRef.current?.toPNG('volstrat-compare-drawdown')}>PNG</button>}>
                <Chart ref={ddRef} option={charts.dd} height={240} group="cmp" ariaLabel="Drawdowns of the selected profiles" />
              </Card>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
