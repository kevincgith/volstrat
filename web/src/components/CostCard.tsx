import { useState } from 'react';
import { num, pct } from '../charts/options';
import type { CostSensitivity } from '../engine/costs';
import type { Params } from '../engine/params';
import type { WireResult } from '../engine/wire';
import { useData } from '../state/data';
import { runJob } from '../state/useRun';
import { Card, Select } from './ui';

/** Trading-cost sensitivity and break-even cost vs a benchmark. */
export function CostCard({ result, params }: { result: WireResult; params: Params }) {
  const { data } = useData();
  const [bench, setBench] = useState('60/40');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ r: CostSensitivity; key: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const key = JSON.stringify([params, bench]);
  const m = result.strategy.metrics;

  const go = async () => {
    if (!data) return;
    setBusy(true);
    setErr(null);
    try {
      const out = await runJob(data, { type: 'costs', id: 0, params, bench }, 'costs');
      setRes({ r: out.result, key });
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="Trading costs"
      actions={
        <>
          <Select label="Break-even vs" value={bench} onChange={setBench} options={result.benchmarks.map((b) => ({ value: b.id, label: b.label }))} />
          <button className="btn primary" onClick={go} disabled={busy}>
            {busy ? 'Computing…' : 'Cost sensitivity'}
          </button>
        </>
      }
    >
      <p className="small" style={{ marginTop: 0 }}>
        At {params.backtest.costBps} bp per side
        {Object.keys(params.backtest.assetCostBps ?? {}).length ? ' (with per-asset overrides)' : ''}: turnover <b>{num(m.turnover, 1)}x</b> a year, costs
        paid <b>{pct(m.costDrag, 2)}</b> of NAV a year over {result.strategy.result.trades} trades. Costs are charged on every unit of notional bought or sold.
      </p>
      {err && <p className="warn small">{err}</p>}
      {res && res.key !== key && <p className="note small">Settings changed since this run. Press the button to refresh.</p>}
      {res && (
        <>
          <div className="table-wrap">
            <table className="data stats">
              <thead>
                <tr>
                  <th>Cost per side</th>
                  {res.r.points.map((p) => (
                    <th key={p.bps} className="num">
                      {p.bps} bp
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Strategy Sharpe</th>
                  {res.r.points.map((p) => (
                    <td key={p.bps} className="num strong">
                      {num(p.sharpe)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Strategy CAGR</th>
                  {res.r.points.map((p) => (
                    <td key={p.bps} className="num">
                      {pct(p.cagr)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Cost drag (p.a.)</th>
                  {res.r.points.map((p) => (
                    <td key={p.bps} className="num">
                      {pct(p.costDrag, 2)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">{res.r.benchmark} Sharpe</th>
                  {res.r.points.map((p) => (
                    <td key={p.bps} className="num">
                      {num(p.benchSharpe)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="callout small">
            <strong>Break-even cost vs {res.r.benchmark}:</strong>{' '}
            {res.r.breakEven !== null ? (
              <>
                <b>{num(res.r.breakEven, 1)} bp per side</b>. Above that, the strategy's Sharpe falls below the benchmark's. Liquid ETFs such as SPY or IEF
                typically cost a few bp per side to trade; leveraged ETFs and odd-lot or less liquid funds can cost more.
              </>
            ) : (
              res.r.breakEvenNote
            )}
          </div>
        </>
      )}
    </Card>
  );
}
