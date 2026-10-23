import { useMemo } from 'react';
import { num, pct } from '../charts/options';
import { equalRisk } from '../engine/equalrisk';
import type { Params } from '../engine/params';
import type { WireResult } from '../engine/wire';
import { useData } from '../state/data';
import { Card } from './ui';

/** The strategy scaled to each benchmark's volatility: timing skill or just less risk? */
export function EqualRiskCard({ result, params }: { result: WireResult; params: Params }) {
  const { data } = useData();
  const rows = useMemo(
    () =>
      data
        ? equalRisk(data.dates, result.strategy.result, result.benchmarks, result.assets.CASH!.returns, params.assets.financingSpread, result.start, result.end)
        : [],
    [data, result, params.assets.financingSpread],
  );
  if (!rows.length) return null;
  const spx = rows.find((r) => r.id === 'spx');

  return (
    <Card title="Equal-risk check">
      <p className="small" style={{ marginTop: 0 }}>
        Lower drawdowns can come from good timing or simply from holding less risk. Here the strategy's daily returns are scaled to each benchmark's
        volatility (borrowing at T-bills + {pct(params.assets.financingSpread, 2)} above 1×, the rest in T-bills below 1×). At equal risk, a strategy with real
        timing skill earns more and draws down less. The scale is set with hindsight, so this is a yardstick, not a tradeable portfolio.
      </p>
      <div className="table-wrap">
        <table className="data stats">
          <thead>
            <tr>
              <th>Benchmark</th>
              <th className="num">Scale</th>
              <th className="num">CAGR: strategy / benchmark</th>
              <th className="num">Max drawdown: strategy / benchmark</th>
              <th className="num">Sharpe: strategy / benchmark</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <th scope="row">{r.label}</th>
                <td className="num">{num(r.k, 2)}×</td>
                <td className="num">
                  <b className={r.scaled.cagr >= r.bench.cagr ? 'pos' : 'neg'}>{pct(r.scaled.cagr)}</b> / {pct(r.bench.cagr)}
                </td>
                <td className="num">
                  <b className={r.scaled.maxDrawdown >= r.bench.maxDrawdown ? 'pos' : 'neg'}>{pct(r.scaled.maxDrawdown)}</b> / {pct(r.bench.maxDrawdown)}
                </td>
                <td className="num">
                  {num(r.scaled.sharpe)} / {num(r.bench.sharpe)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {spx && (
        <div className="callout small">
          At the S&amp;P 500's volatility the strategy would have compounded at <b>{pct(spx.scaled.cagr)}</b> a year vs <b>{pct(spx.bench.cagr)}</b>, with a
          worst drawdown of <b>{pct(spx.scaled.maxDrawdown)}</b> vs <b>{pct(spx.bench.maxDrawdown)}</b>.{' '}
          {spx.scaled.cagr > spx.bench.cagr + 0.005
            ? 'The drawdown control adds return at equal risk.'
            : 'At equal risk the advantage mostly disappears: the lower drawdowns come largely from holding less risk.'}
        </div>
      )}
    </Card>
  );
}
