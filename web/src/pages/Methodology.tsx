import { useMemo } from 'react';
import { Card, ErrorBox, Loading } from '../components/ui';
import { colors } from '../charts/palette';
import { COMPONENTS } from '../engine/components';
import type { MarketData } from '../engine/data';
import { REGIMES, rawFeature } from '../engine/score';
import type { WireResult } from '../engine/wire';
import { useData } from '../state/data';
import { useParams } from '../state/params';
import { useRun } from '../state/useRun';
import { useTheme } from '../theme';

const REPO = 'https://github.com/kevincgith/volstrat/blob/main/docs/METHODOLOGY.md';

const EPISODES = [
  { id: 'gfc', label: '2008 GFC', from: '2008-09-01', to: '2009-03-31' },
  { id: 'volm', label: 'Feb 2018 Volmageddon', from: '2018-01-26', to: '2018-04-30' },
  { id: 'covid', label: '2020 Covid crash', from: '2020-02-19', to: '2020-04-30' },
  { id: 'y2022', label: '2022 rate shock', from: '2022-01-03', to: '2022-10-31' },
];

function range(dates: string[], from: string, to: string): [number, number] {
  const a = dates.findIndex((d) => d >= from);
  let b = dates.length - 1;
  while (b > 0 && dates[b]! > to) b--;
  return [a, b];
}

const short = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'UTC' });

function extreme(x: ArrayLike<number>, a: number, b: number, max: boolean) {
  let best = NaN;
  let at = -1;
  for (let t = a; t <= b; t++) {
    const v = x[t]!;
    if (!Number.isFinite(v)) continue;
    if (at < 0 || (max ? v > best : v < best)) {
      best = v;
      at = t;
    }
  }
  return { v: best, at };
}

function fmt(v: number, unit: string) {
  if (!Number.isFinite(v)) return '–';
  if (Math.abs(v) < 0.05 && unit !== 'ratio') v = 0;
  if (unit === 'ratio') return v.toFixed(2);
  if (Math.abs(v) >= 100) return v.toFixed(0);
  return v.toFixed(1);
}

function EpisodeTables({ data, result }: { data: MarketData; result: WireResult }) {
  const { theme } = useTheme();
  const c = colors(theme);
  const eps = useMemo(() => EPISODES.map((e) => ({ ...e, idx: range(data.dates, e.from, e.to) })), [data]);
  const comps = COMPONENTS.filter((x) => x.defaultEnabled || x.id === 'move');
  const spx = result.benchmarks.find((b) => b.id === 'spx')!.result.nav;
  const nav = result.strategy.result.nav;
  const ret = (n: Float64Array, a: number, b: number) => (Number.isFinite(n[a]!) && Number.isFinite(n[b]!) ? n[b]! / n[a]! - 1 : NaN);

  return (
    <>
      <Card title="How the score behaved in stress episodes">
        <p className="muted small">
          Computed live from the dataset with the parameters currently set on the Backtest page. Lowest composite score and date, days spent in Crisis /
          Risk-Off, and return over the episode window.
        </p>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th />
                {eps.map((e) => (
                  <th key={e.id} className="num">
                    {e.label}
                    <div className="muted small">
                      {short(e.from)} – {short(e.to)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Lowest composite score</th>
                {eps.map((e) => {
                  const m = extreme(result.score.score, e.idx[0], e.idx[1], false);
                  return (
                    <td key={e.id} className="num">
                      {m.at >= 0 ? (
                        <>
                          {m.v.toFixed(1)} <span className="muted small">{short(data.dates[m.at]!)}</span>
                        </>
                      ) : (
                        '–'
                      )}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <th scope="row">Days in Crisis / Risk-Off</th>
                {eps.map((e) => {
                  let n = 0;
                  let k = 0;
                  for (let t = e.idx[0]; t <= e.idx[1]; t++) {
                    if (result.regimes[t]! >= 0) n++;
                    if (result.regimes[t]! >= 0 && result.regimes[t]! <= 1) k++;
                  }
                  return (
                    <td key={e.id} className="num">
                      {n ? `${((100 * k) / n).toFixed(0)}%` : '–'}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <th scope="row">First Crisis / Risk-Off day</th>
                {eps.map((e) => {
                  let first = -1;
                  for (let t = e.idx[0]; t <= e.idx[1]; t++) if (result.regimes[t]! >= 0 && result.regimes[t]! <= 1) { first = t; break; }
                  return (
                    <td key={e.id} className="num">
                      {first >= 0 ? short(data.dates[first]!) : 'none'}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <th scope="row">S&amp;P 500 return</th>
                {eps.map((e) => (
                  <td key={e.id} className="num">
                    {Number.isFinite(ret(spx, e.idx[0], e.idx[1])) ? `${(100 * ret(spx, e.idx[0], e.idx[1])).toFixed(1)}%` : '–'}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">Strategy return</th>
                {eps.map((e) => (
                  <td key={e.id} className="num strong">
                    {Number.isFinite(ret(nav, e.idx[0], e.idx[1])) ? `${(100 * ret(nav, e.idx[0], e.idx[1])).toFixed(1)}%` : <span className="muted small">before backtest start</span>}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Component extremes in each episode">
        <p className="muted small">The most stressed reading of each raw input within the window (maximum if high = stress, minimum otherwise), with its date.</p>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Component</th>
                <th>Direction</th>
                {eps.map((e) => (
                  <th key={e.id} className="num">
                    {e.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comps.map((def) => {
                const raw = rawFeature(data, def);
                return (
                  <tr key={def.id}>
                    <th scope="row">{def.label}</th>
                    <td className="small muted">
                      <span className="dot" style={{ background: c.regime[0] }} aria-hidden="true" />
                      {def.riskOffWhenHigh ? 'high' : 'low'}
                    </td>
                    {eps.map((e) => {
                      const m = extreme(raw, e.idx[0], e.idx[1], def.riskOffWhenHigh);
                      return (
                        <td key={e.id} className="num">
                          {m.at >= 0 ? (
                            <>
                              {fmt(m.v, def.unit)} <span className="muted small">{short(data.dates[m.at]!)}</span>
                            </>
                          ) : (
                            <span className="muted small">no data</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

export default function Methodology() {
  const { data, error } = useData();
  const [params] = useParams();
  const { result } = useRun(data, params);
  const { theme } = useTheme();
  const c = colors(theme);

  return (
    <section className="page methodology">
      <div className="page-head">
        <h1>Methodology</h1>
        <p className="muted">
          How the score is built, how it maps to portfolios and how the backtest is run, in plain English. The full technical document, with data-source
          details, is <a href={REPO}>docs/METHODOLOGY.md</a>.
        </p>
      </div>

      <Card title="The idea in one paragraph">
        <p>
          Volatility markets price fear in real time. When investors scramble for protection, implied volatility rises, near-dated options become more
          expensive than longer-dated ones, credit spreads widen and prices break trend. These conditions tend to cluster and persist, and risk assets have
          historically delivered poor risk-adjusted returns while they last. VolStrat measures several of these symptoms each day, converts each into a
          0–100 score using <strong>only past data</strong>, averages them into a <strong>risk-appetite score</strong>, and holds more equity (even
          leverage) when the score is high and more bonds, gold, utilities or cash when it is low.
        </p>
        <ol className="flow">
          <li>
            <strong>Measure</strong>: daily inputs (VIX family, VIX futures, put/call, credit, trend), each aligned to the day it was actually published.
          </li>
          <li>
            <strong>Standardise</strong>: each input's percentile rank (or z-score) within a trailing window, so 90 means "more stressed than 90% of the last 3
            years".
          </li>
          <li>
            <strong>Combine</strong>: weighted average with each input oriented so that 100 = risk-on, smoothed with a short EMA.
          </li>
          <li>
            <strong>Classify</strong>: five regimes, with a hysteresis band to avoid flip-flopping around cut-offs.
          </li>
          <li>
            <strong>Allocate &amp; simulate</strong>: the regime's portfolio, traded at the next close, with costs.
          </li>
        </ol>
      </Card>

      <Card title="Signal components">
        <div className="comp-docs">
          {COMPONENTS.map((def) => (
            <details key={def.id} className="comp-doc-item">
              <summary>
                <span className="dot" style={{ background: def.defaultEnabled ? c.series[0] : c.axis }} aria-hidden="true" />
                <strong>{def.label}</strong>
                <span className="muted small">
                  {' '}
                  · {def.group} · {def.riskOffWhenHigh ? 'high = risk-off' : 'low = risk-off'} · default {def.defaultEnabled ? `weight ${def.defaultWeight}` : 'off'}
                </span>
              </summary>
              <dl>
                <dt>What it measures</dt>
                <dd>{def.doc.what}</dd>
                <dt>Why it matters</dt>
                <dd>{def.doc.why}</dd>
                <dt>Typical range</dt>
                <dd>{def.doc.range}</dd>
                <dt>In past episodes</dt>
                <dd>{def.doc.episodes}</dd>
                <dt>Inputs</dt>
                <dd>
                  {def.inputs
                    .map((k) => {
                      if (k.startsWith('asset:')) return data?.assets[k.slice(6)]?.label ?? k;
                      const m = data?.seriesMeta[k];
                      return m ? `${m.label} — ${m.source}, from ${m.first}${m.lag_bdays ? `, ${m.lag_bdays}-day publication lag` : ''}${m.lag_days ? `, ${m.lag_days}-day publication lag` : ''}` : `${k} (no data)`;
                    })
                    .join('; ')}
                </dd>
              </dl>
            </details>
          ))}
        </div>
      </Card>

      {error ? <ErrorBox message={error} /> : !data || !result ? <Loading label="Computing episode statistics…" /> : <EpisodeTables data={data} result={result} />}

      <Card title="Score, regimes and allocation">
        <dl className="defs">
          <dt>Standardisation</dt>
          <dd>
            Percentile rank of today's value within the trailing window (default 3 years, ties count half), or a z-score against the trailing mean and
            standard deviation mapped through the normal distribution. No full-sample statistics are ever used: they would leak information from the future.
            A component is only used after 252 observations.
          </dd>
          <dt>Composite</dt>
          <dd>
            Weighted average of the available components. If a component has no data on a day, the remaining weights are rescaled. If less than half the
            enabled weight is available, there is no score and no position.
          </dd>
          <dt>Regimes</dt>
          <dd>
            Default cut-offs 20 / 40 / 60 / 80 give {REGIMES.join(', ')}. Hysteresis (default 2.5 points) means the score must cross a cut-off by that margin
            before the regime changes. Averaging many components pulls the composite toward 50, so the extreme regimes are rare by construction. The cut-offs
            were deliberately not tuned to the realised distribution.
          </dd>
          <dt>Allocation</dt>
          <dd>
            Each regime has an editable portfolio (default: T-bills → bonds/gold/utilities → 60/40 → S&amp;P 500 → 2x S&amp;P 500). Continuous mode instead
            scales equity exposure linearly with the score, using a leveraged ETF above 100%.
          </dd>
        </dl>
      </Card>

      <Card title="Backtest assumptions">
        <dl className="defs">
          <dt>Timing</dt>
          <dd>Signal computed after the close of day t; trade at the close of t+1 (or later, configurable); returns from t+2. Tests prove that changing any data after t cannot change any decision up to t.</dd>
          <dt>Costs</dt>
          <dd>5 bp per side by default on every unit traded. ETF returns are net of their expense ratios; where an index or futures proxy stands in, the ETF's expense ratio is deducted.</dd>
          <dt>Leverage</dt>
          <dd>
            Real SSO/UPRO returns after launch. Before launch they are synthetic: daily L × S&amp;P 500 total return − (L−1) × (T-bill + 0.75%) − fees. The
            spread is calibrated so the synthetic 2x matches the real SSO over 2006–2026 (daily correlation 0.997).
          </dd>
          <dt>Proxies</dt>
          <dd>Before ETF inception, returns come from indices or mutual funds (e.g. Vanguard Treasury funds before IEF/TLT). Periods where the strategy held a proxy are shaded grey on the equity chart.</dd>
          <dt>Benchmarks</dt>
          <dd>S&amp;P 500 and MSCI World buy-and-hold; 80/20, 60/40, 40/60 equity/bond rebalanced monthly; and a naive volatility-targeting portfolio (S&amp;P 500 weight = 12% ÷ 21-day realised vol, capped at 100%, rest in T-bills).</dd>
        </dl>
      </Card>

      <Card title="Reading the statistics">
        <dl className="defs">
          <dt>Sharpe / Sortino</dt>
          <dd>Return above T-bills per unit of total (Sharpe) or downside (Sortino) volatility, annualised.</dd>
          <dt>Max drawdown / Calmar / Ulcer</dt>
          <dd>Worst peak-to-trough loss; CAGR divided by that loss; and the root-mean-square of all drawdowns, which penalises long, deep underwater periods.</dd>
          <dt>Up / down capture</dt>
          <dd>Average monthly return in months when the S&amp;P 500 rose (fell), relative to the S&amp;P 500's. Below 100% downside capture means losing less in down months.</dd>
          <dt>Turnover / holding period</dt>
          <dd>One-way annual turnover (1.0x = the whole portfolio traded once a year) and its inverse.</dd>
        </dl>
      </Card>

      <Card title="Overfitting and limitations">
        <ul className="plain">
          <li>
            Every parameter you try on the same history is another test. The robustness panel on the Backtest page shows a sensitivity grid, a walk-forward
            test and the Sharpe ratio you would expect from the best of N worthless strategies. On the 2026 data, walk-forward re-tuning did <em>not</em>{' '}
            beat the fixed defaults out of sample.
          </li>
          <li>The full component set exists only from about 2006, so the evidence rests on a handful of crises.</li>
          <li>The asset menu (US equities, Treasuries, gold) was chosen with knowledge of how those assets behaved after 2000.</li>
          <li>FRED series (HY OAS, NFCI, STLFSI) cannot be downloaded without an API key; credit is covered by an ETF-based proxy.</li>
          <li>Closing-price execution, no taxes, no market impact. Hypothetical results only.</li>
        </ul>
      </Card>
    </section>
  );
}
