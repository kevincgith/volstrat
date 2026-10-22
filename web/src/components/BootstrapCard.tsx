import { useState } from 'react';
import { num, pct } from '../charts/options';
import { pairedBootstrap, type BootstrapResult } from '../engine/bootstrap';
import type { WireResult } from '../engine/wire';
import { Card, Select } from './ui';

/** "Is the edge luck?" Paired stationary-bootstrap confidence intervals vs a benchmark. */
export function BootstrapCard({ result, paramsKey }: { result: WireResult; paramsKey: string }) {
  const [bench, setBench] = useState('spx');
  const [n, setN] = useState(1000);
  const [block, setBlock] = useState(21);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ r: BootstrapResult; key: string; label: string } | null>(null);
  const key = JSON.stringify([paramsKey, bench, n, block]);

  const go = () => {
    setBusy(true);
    // let the button state paint before the synchronous computation
    setTimeout(() => {
      const b = result.benchmarks.find((x) => x.id === bench)!;
      const s = result.start + 1;
      const e = result.end;
      const strat = Array.from(result.strategy.result.returns.slice(s, e + 1));
      const ben = Array.from(b.result.returns.slice(s, e + 1));
      const cash = Array.from(result.assets.CASH!.returns.slice(s, e + 1), (x) => (Number.isFinite(x) ? x : 0));
      setRes({ r: pairedBootstrap(strat, ben, cash, { n, blockLen: block }), key, label: b.label });
      setBusy(false);
    }, 20);
  };

  const r = res?.r;
  const verdict = (p: number) =>
    p >= 0.95 ? 'strong evidence of an edge' : p >= 0.8 ? 'suggestive, not conclusive' : p <= 0.2 ? 'evidence the benchmark is better' : 'indistinguishable from luck';

  return (
    <Card
      title="Is the edge luck? (bootstrap confidence)"
      actions={
        <>
          <Select label="Versus" value={bench} onChange={setBench} options={result.benchmarks.map((b) => ({ value: b.id, label: b.label }))} />
          <Select label="Block length" value={block} onChange={setBlock} options={[5, 21, 63].map((v) => ({ value: v, label: `${v} days` }))} />
          <Select label="Resamples" value={n} onChange={setN} options={[500, 1000, 2000].map((v) => ({ value: v, label: String(v) }))} />
          <button className="btn primary" onClick={go} disabled={busy}>
            {busy ? 'Resampling…' : 'Run bootstrap'}
          </button>
        </>
      }
    >
      <p className="muted small" style={{ marginTop: 0 }}>
        Resamples the backtest's daily history in random blocks (same days for strategy and benchmark, so their correlation is kept) and recomputes the
        statistics each time. The spread of outcomes shows how much of the measured difference could be noise.
      </p>
      {res && res.key !== key && <p className="note small">Settings changed since this run. Press Run to refresh.</p>}
      {r && (
        <>
          <div className="table-wrap">
            <table className="data stats">
              <thead>
                <tr>
                  <th />
                  <th className="num">Observed</th>
                  <th className="num">5th pct</th>
                  <th className="num">Median</th>
                  <th className="num">95th pct</th>
                  <th className="num">P(strategy better)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Sharpe difference vs {res!.label}</th>
                  <td className="num strong">{num(r.observed.sharpeDiff)}</td>
                  <td className="num">{num(r.sharpeDiff.p5)}</td>
                  <td className="num">{num(r.sharpeDiff.p50)}</td>
                  <td className="num">{num(r.sharpeDiff.p95)}</td>
                  <td className="num strong">{pct(r.sharpeDiff.probPositive, 0)}</td>
                </tr>
                <tr>
                  <th scope="row">CAGR difference</th>
                  <td className="num strong">{pct(r.observed.cagrDiff)}</td>
                  <td className="num">{pct(r.cagrDiff.p5)}</td>
                  <td className="num">{pct(r.cagrDiff.p50)}</td>
                  <td className="num">{pct(r.cagrDiff.p95)}</td>
                  <td className="num">{pct(r.cagrDiff.probPositive, 0)}</td>
                </tr>
                <tr>
                  <th scope="row">Max drawdown – strategy</th>
                  <td className="num">–</td>
                  <td className="num">{pct(r.mddStrategy.p5)}</td>
                  <td className="num">{pct(r.mddStrategy.p50)}</td>
                  <td className="num">{pct(r.mddStrategy.p95)}</td>
                  <td className="num">–</td>
                </tr>
                <tr>
                  <th scope="row">Max drawdown – {res!.label}</th>
                  <td className="num">–</td>
                  <td className="num">{pct(r.mddBenchmark.p5)}</td>
                  <td className="num">{pct(r.mddBenchmark.p50)}</td>
                  <td className="num">{pct(r.mddBenchmark.p95)}</td>
                  <td className="num">–</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="callout small">
            <strong>Reading.</strong> Sharpe edge: {verdict(r.sharpeDiff.probPositive)} ({pct(r.sharpeDiff.probPositive, 0)} of {r.n} resampled histories). Drawdown: in
            the worst 5% of resampled histories the strategy's max drawdown was {pct(r.mddStrategy.p5, 0)} against {pct(r.mddBenchmark.p5, 0)} for{' '}
            {res!.label}. Bootstrapping assumes the past return distribution is representative and does not account for the parameters having been chosen on
            this same history.
          </div>
        </>
      )}
    </Card>
  );
}
