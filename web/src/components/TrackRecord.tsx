import { useEffect, useMemo, useState } from 'react';
import { pct } from '../charts/options';
import { colors } from '../charts/palette';
import type { Weights } from '../engine/allocation';
import { buildAssets } from '../engine/assets';
import { simulate } from '../engine/backtest';
import type { MarketData } from '../engine/data';
import { BASE_PARAMS, merge, type Params } from '../engine/params';
import { REGIMES } from '../engine/score';
import { useTheme } from '../theme';
import { Card } from './ui';

interface Decision {
  date: string;
  score: number;
  regime: string;
  weights: Weights;
  cutoff: string;
  recorded: string;
}
interface Track {
  version: string;
  label?: string;
  frozen_at_utc: string;
  params: Params;
  decisions: Decision[];
}
/** Current format lists every version; before v2 the file held v1 alone. */
type TrackFile = { tracks: Track[] } | Track;

/**
 * Live, out-of-sample track records: decisions logged daily with frozen
 * parameters (append-only, data/track/vN), replayed against actual returns.
 */
export function TrackRecord({ data }: { data: MarketData }) {
  const [tracks, setTracks] = useState<Track[] | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/track_record.json`, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: TrackFile) => setTracks('tracks' in j ? j.tracks : [j]))
      .catch(() => setTracks([]));
  }, [data.meta.generated_at]); // reload with each new data build

  if (!tracks) return null;
  return (
    <>
      {tracks.map((t) => (
        <TrackCard key={t.version} track={t} data={data} />
      ))}
    </>
  );
}

function TrackCard({ track, data }: { track: Track; data: MarketData }) {
  const { theme } = useTheme();
  const c = colors(theme);
  const perf = useMemo(() => {
    if (!track.decisions.length) return null;
    // as in scripts/signal.ts: fields added after freezing are off
    const p = merge(BASE_PARAMS, track.params);
    const assets = buildAssets(data, p.assets);
    const idx = new Map(data.dates.map((d, i) => [d, i]));
    const first = idx.get(track.decisions[0]!.date);
    if (first === undefined) return null;
    // target in force on each day = the latest logged decision dated on or before it
    const targets: (Weights | null)[] = new Array(data.dates.length).fill(null);
    let k = 0;
    for (let t = first; t < data.dates.length; t++) {
      while (k + 1 < track.decisions.length && track.decisions[k + 1]!.date <= data.dates[t]!) k++;
      targets[t] = track.decisions[k]!.weights;
    }
    const end = data.dates.length - 1;
    const lag = Math.max(1, p.backtest.lag);
    const strat = simulate(data.dates, assets, targets, p.backtest, first + lag, end);
    const fixed = (w: Weights) => new Array<Weights | null>(data.dates.length).fill(w);
    const bt = { ...p.backtest, rebalance: 'monthly' as const, band: 0 };
    const spx = simulate(data.dates, assets, fixed({ SPX: 1 }), bt, first + lag, end);
    const b6040 = simulate(data.dates, assets, fixed({ SPX: 0.6, AGG: 0.4 }), bt, first + lag, end);
    const s = strat.start;
    const ret = (nav: Float64Array) => (s <= end && Number.isFinite(nav[end]!) ? nav[end]! / nav[s]! - 1 : NaN);
    return { start: s <= end ? data.dates[s] : null, days: Math.max(0, end - s), strat: ret(strat.nav), spx: ret(spx.nav), b6040: ret(b6040.nav) };
  }, [track, data]);

  const last = track.decisions.at(-1);
  const recent = [...track.decisions].reverse().slice(0, 8);
  return (
    <Card title={`Live track record ${track.version}: ${track.label ?? 'Balanced'} (out-of-sample)`}>
      <p className="small" style={{ marginTop: 0 }}>
        Decisions are logged after every daily data run with the {track.label ?? 'Balanced'} parameters frozen on {track.frozen_at_utc.slice(0, 10)},
        appended only and never revised. The log lives in the repository (<code>data/track/{track.version}/decisions.csv</code>), so its history is auditable.
        {track.version === 'v1' && ' v1 kept the Balanced defaults when the defaults changed to Growth on 2026-10-23; it continues unchanged.'} This is the only
        part of the site that is not a backtest.
      </p>
      {perf && perf.start && perf.days > 0 ? (
        <div className="track-stats">
          <div>
            <div className="muted small">Live since</div>
            <b>{perf.start}</b> <span className="muted small">({perf.days} trading days)</span>
          </div>
          <div>
            <div className="muted small">Strategy</div>
            <b>{pct(perf.strat, 2)}</b>
          </div>
          <div>
            <div className="muted small">S&amp;P 500</div>
            <b>{pct(perf.spx, 2)}</b>
          </div>
          <div>
            <div className="muted small">60/40</div>
            <b>{pct(perf.b6040, 2)}</b>
          </div>
        </div>
      ) : (
        <p className="muted small">
          First decision logged for the close of <b>{track.decisions[0]?.date}</b>; it is executed at the next close, so live returns start accruing from
          then. Too early to evaluate — this record grows every trading day.
        </p>
      )}
      <div className="table-wrap">
        <table className="data compact">
          <thead>
            <tr>
              <th>Signal close</th>
              <th className="num">Score</th>
              <th>Regime</th>
              <th>Target (traded next close)</th>
              <th>Recorded (UTC)</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((d) => {
              const ri = REGIMES.indexOf(d.regime as (typeof REGIMES)[number]);
              return (
                <tr key={d.date}>
                  <td>{d.date}</td>
                  <td className="num">{d.score.toFixed(1)}</td>
                  <td>
                    {ri >= 0 && <span className="dot" style={{ background: c.regime[ri] }} aria-hidden="true" />}
                    {d.regime}
                  </td>
                  <td className="small">
                    {Object.entries(d.weights)
                      .map(([k, v]) => `${k} ${Math.round((v ?? 0) * 100)}%`)
                      .join(', ')}
                  </td>
                  <td className="muted small">{d.recorded.replace('T', ' ').replace('Z', '')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {last && <p className="muted small">Latest logged decision: {last.regime} as of the {last.date} close.</p>}
    </Card>
  );
}
