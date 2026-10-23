import type { ReactNode } from 'react';
import type { Weights } from '../engine/allocation';
import { STRATEGY_ASSETS, type AssetKey } from '../engine/assets';
import { COMPONENTS, type ComponentGroup } from '../engine/components';
import { DEFAULT_PARAMS, PRESETS, presetParams, type Params } from '../engine/params';
import { REGIMES } from '../engine/score';
import { DateInput, NumberInput, Section, Segmented, Select, Toggle } from './ui';

const ASSET_LABEL: Record<AssetKey, string> = {
  SPX: 'S&P 500',
  SSO: 'S&P 500 2x',
  UPRO: 'S&P 500 3x',
  WORLD: 'MSCI World',
  IEF: 'Treasuries 7-10y',
  TLT: 'Treasuries 20y+',
  AGG: 'US Agg bonds',
  SHY: 'Treasuries 1-3y',
  BIL: 'T-bills',
  GLD: 'Gold',
  XLU: 'Utilities',
};

export function assetLabel(k: string) {
  return ASSET_LABEL[k as AssetKey] ?? k;
}

function WeightsEditor({ value, onChange, title }: { value: Weights; onChange: (w: Weights) => void; title: ReactNode }) {
  const entries = Object.entries(value) as [AssetKey, number][];
  const total = entries.reduce((a, [, v]) => a + (v ?? 0), 0);
  const unused = STRATEGY_ASSETS.filter((k) => !(k in value));
  return (
    <div className="weights-editor">
      <div className="we-head">
        {title}
        <span className={Math.abs(total - 1) > 1e-6 ? 'warn small' : 'muted small'}>
          {(total * 100).toFixed(0)}%{Math.abs(total - 1) > 1e-6 ? ' (normalised to 100%)' : ''}
        </span>
      </div>
      {entries.map(([k, v]) => (
        <div className="we-row" key={k}>
          <span>{assetLabel(k)}</span>
          <input
            type="number"
            aria-label={`${assetLabel(k)} weight %`}
            value={+(v * 100).toFixed(4)}
            min={0}
            step={5}
            onChange={(e) => {
              const x = parseFloat(e.target.value);
              if (Number.isFinite(x)) onChange({ ...value, [k]: Math.max(0, x / 100) });
            }}
          />
          <span className="muted">%</span>
          <button
            className="btn ghost tiny"
            aria-label={`Remove ${assetLabel(k)}`}
            onClick={() => {
              const next = { ...value };
              delete next[k];
              onChange(next);
            }}
          >
            ×
          </button>
        </div>
      ))}
      {unused.length > 0 && (
        <select
          className="we-add"
          value=""
          aria-label="Add asset"
          onChange={(e) => e.target.value && onChange({ ...value, [e.target.value]: 0.1 })}
        >
          <option value="">+ add asset…</option>
          {unused.map((k) => (
            <option key={k} value={k}>
              {assetLabel(k)}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

const GROUPS: ComponentGroup[] = ['Volatility', 'Term structure', 'Sentiment', 'Credit', 'Trend', 'Macro', 'VTS-style'];

export function ParamPanel({
  params,
  setParams,
  regimeColors,
  availability,
}: {
  params: Params;
  setParams: (p: Params) => void;
  regimeColors: string[];
  /** First date with data per component id (for the hint). */
  availability: Record<string, string | null>;
}) {
  const up = (f: (d: Params) => void) => {
    const d = structuredClone(params);
    f(d);
    setParams(d);
  };
  const sp = params.score;
  const al = params.allocation;

  return (
    <div className="param-panel">
      <Section title="Presets & period" open>
        <div className="chips">
          {PRESETS.map((p) => (
            <button key={p.id} className="chip" title={p.description} onClick={() => setParams({ ...presetParams(p.id), period: params.period })}>
              {p.label}
            </button>
          ))}
          <button className="chip" onClick={() => setParams(structuredClone(DEFAULT_PARAMS))} title="Reset every parameter to its default">
            Reset
          </button>
        </div>
        <div className="row-2">
          <DateInput label="Start" value={params.period.start} onChange={(v) => up((d) => void (d.period.start = v))} hint="Backtest start; moved later automatically if signals or assets are not yet available." />
          <DateInput label="End" value={params.period.end} onChange={(v) => up((d) => void (d.period.end = v))} hint="Blank = latest data." />
        </div>
        <DateInput
          label="Out-of-sample from"
          value={params.period.oosStart}
          onChange={(v) => up((d) => void (d.period.oosStart = v))}
          hint="Optional split date: statistics are shown separately before (in-sample) and after (out-of-sample). Tune on the in-sample period only."
        />
      </Section>

      <Section title="Signal components" open>
        {GROUPS.map((g) => (
          <div key={g} className="comp-group">
            <div className="comp-group-title">{g}</div>
            {COMPONENTS.filter((c) => c.group === g).map((c) => {
              const s = sp.components[c.id]!;
              const first = availability[c.id];
              return (
                <div className={`comp-row ${s.enabled ? '' : 'off'}`} key={c.id}>
                  <Toggle
                    label={c.label}
                    checked={s.enabled}
                    onChange={(v) => up((d) => void (d.score.components[c.id]!.enabled = v))}
                    title={`${c.doc.what}${first ? ` Data from ${first}.` : ' No data available.'}`}
                  />
                  <input
                    type="number"
                    className="w-input"
                    aria-label={`${c.label} weight`}
                    value={s.weight}
                    min={0}
                    max={5}
                    step={0.25}
                    disabled={!s.enabled}
                    onChange={(e) => {
                      const x = parseFloat(e.target.value);
                      if (Number.isFinite(x)) up((d) => void (d.score.components[c.id]!.weight = Math.max(0, x)));
                    }}
                  />
                  <button
                    className={`btn ghost tiny ${s.oneSided ? 'on' : ''}`}
                    title="One-sided: count only the stress side (score capped at 50). Tested for the VRP and rejected out of sample; see METHODOLOGY 15.3."
                    aria-pressed={!!s.oneSided}
                    disabled={!s.enabled}
                    onClick={() => up((d) => void (d.score.components[c.id]!.oneSided = !s.oneSided))}
                  >
                    ½
                  </button>
                  <button
                    className={`btn ghost tiny ${s.invert ? 'on' : ''}`}
                    title={`Direction: ${c.riskOffWhenHigh !== s.invert ? 'high = risk-off' : 'low = risk-off'} (click to invert)`}
                    aria-pressed={s.invert}
                    disabled={!s.enabled}
                    onClick={() => up((d) => void (d.score.components[c.id]!.invert = !s.invert))}
                  >
                    ⇅
                  </button>
                  {!first && <span className="warn small" title="No data in the current dataset">no data</span>}
                </div>
              );
            })}
          </div>
        ))}
      </Section>

      <Section title="Standardisation & smoothing">
        <Select
          label="Method"
          value={sp.method}
          onChange={(v) => up((d) => void (d.score.method = v))}
          options={[
            { value: 'percentile', label: 'Percentile rank' },
            { value: 'zscore', label: 'Z-score → normal CDF' },
          ]}
          hint="How each component is converted to 0-100 using only past data."
        />
        <Select
          label="Window"
          value={sp.window}
          onChange={(v) => up((d) => void (d.score.window = v))}
          options={[
            { value: 252, label: '1 year (252d)' },
            { value: 504, label: '2 years' },
            { value: 756, label: '3 years' },
            { value: 1260, label: '5 years' },
            { value: 2520, label: '10 years' },
            { value: 0, label: 'Expanding' },
          ]}
          hint="Trailing window for the percentile / z-score."
        />
        <div className="row-2">
          <NumberInput label="Min history (days)" value={sp.minPeriods} min={20} step={21} onChange={(v) => up((d) => void (d.score.minPeriods = Math.round(v)))} hint="A component is only used once it has this many observations." />
          <NumberInput label="Smoothing (EMA days)" value={sp.smoothing} min={1} step={1} onChange={(v) => up((d) => void (d.score.smoothing = Math.max(1, Math.round(v))))} hint="1 = no smoothing." />
        </div>
        <Toggle
          label="Re-rank the composite against its own history"
          checked={!!sp.rerank}
          onChange={(v) => up((d) => void (d.score.rerank = v))}
          title="Ranks the averaged score within the same trailing window before smoothing, so regime cut-offs become frequencies. Tested and rejected out of sample (turnover doubles); see METHODOLOGY 15.3."
        />
        <NumberInput label="Min coverage" value={sp.minCoverage} scale={100} suffix="%" min={0} max={100} step={5} onChange={(v) => up((d) => void (d.score.minCoverage = Math.min(1, Math.max(0, v))))} hint="Share of the enabled weight that must have data for the score to be defined." />
      </Section>

      <Section title="Regimes">
        <div className="threshold-row">
          {params.regime.thresholds.map((t, i) => (
            <NumberInput
              key={i}
              label={`${REGIMES[i]} | ${REGIMES[i + 1]}`}
              value={t}
              min={0}
              max={100}
              step={1}
              onChange={(v) =>
                up((d) => {
                  d.regime.thresholds[i] = v;
                  d.regime.thresholds.sort((a, b) => a - b);
                })
              }
            />
          ))}
        </div>
        <div className="row-2">
          <NumberInput
            label="Buffer to move up (pts)"
            value={params.regime.bufferUp ?? params.regime.hysteresis}
            min={0}
            step={0.5}
            onChange={(v) => up((d) => void (d.regime.bufferUp = Math.max(0, v)))}
            hint="Toward risk-on: the score must exceed a cut-off by this much. 0 = switch as soon as the cut-off is crossed."
          />
          <NumberInput
            label="Buffer to move down (pts)"
            value={params.regime.bufferDown ?? params.regime.hysteresis}
            min={0}
            step={0.5}
            onChange={(v) => up((d) => void (d.regime.bufferDown = Math.max(0, v)))}
            hint="Toward risk-off: the score must fall below a cut-off by this much. E.g. up 0 / down 5 with a cut-off at 50: switch up at 50, back down only below 45."
          />
          <NumberInput
            label="Min days in regime"
            value={params.regime.minHoldDays ?? 0}
            min={0}
            step={5}
            onChange={(v) => up((d) => void (d.regime.minHoldDays = Math.max(0, Math.round(v))))}
            hint="After a switch, stay at least this many trading days before switching again (0 = off)."
          />
        </div>
        <Toggle
          label="Always allow de-risking immediately"
          checked={params.regime.fastDerisk ?? true}
          onChange={(v) => up((d) => void (d.regime.fastDerisk = v))}
          title="With a minimum holding period, still move down (toward risk-off) without waiting."
        />
        <div className="rebound-box">
          <Toggle
            label="Panic-rebound override (contrarian)"
            checked={!!params.regime.rebound?.enabled}
            onChange={(v) => up((d) => void (d.regime.rebound = { ...(d.regime.rebound ?? DEFAULT_PARAMS.regime.rebound!), enabled: v }))}
            title="After VIX/VIX3M inverts above the peak level and then normalises below the normal level, Crisis/Risk-Off is lifted to the chosen regime for a number of days. Rule fixed before testing; see METHODOLOGY 15."
          />
          {params.regime.rebound?.enabled && (
            <div className="row-2" style={{ marginTop: 6 }}>
              <NumberInput label="Panic: VIX/VIX3M above" value={params.regime.rebound.peak} step={0.05} min={1} onChange={(v) => up((d) => void (d.regime.rebound!.peak = v))} />
              <NumberInput label="…within (days)" value={params.regime.rebound.lookback} step={5} min={1} onChange={(v) => up((d) => void (d.regime.rebound!.lookback = Math.max(1, Math.round(v))))} />
              <NumberInput label="Re-enter when below" value={params.regime.rebound.normal} step={0.05} min={0.5} onChange={(v) => up((d) => void (d.regime.rebound!.normal = v))} />
              <NumberInput label="Hold (days)" value={params.regime.rebound.hold} step={5} min={1} onChange={(v) => up((d) => void (d.regime.rebound!.hold = Math.max(1, Math.round(v))))} />
              <Select
                label="Lift to"
                value={params.regime.rebound.toRegime}
                onChange={(v) => up((d) => void (d.regime.rebound!.toRegime = v))}
                options={[1, 2, 3].map((i) => ({ value: i, label: REGIMES[i]! }))}
              />
            </div>
          )}
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Defaults (1.10 / 20 / 1.00 / 20 days / Neutral) were fixed before testing. Out of sample (2017–2026): Sharpe 0.75 → 0.85; changing them now
            would be fitting.
          </p>
        </div>
        <p className="muted small" style={{ margin: '6px 0 0' }}>
          Buffers stop the allocation flip-flopping when the score hovers around a cut-off. Asymmetric buffers let you re-risk quickly but de-risk only
          on a clear drop, or the reverse.
        </p>
      </Section>

      <Section title="Allocation" open>
        <Segmented
          ariaLabel="Allocation mode"
          value={al.mode}
          onChange={(v) => up((d) => void (d.allocation.mode = v))}
          options={[
            { value: 'regime', label: 'Regime portfolios' },
            { value: 'continuous', label: 'Continuous' },
          ]}
        />
        {al.mode === 'regime' ? (
          [...REGIMES]
            .map((r, i) => ({ r, i }))
            .reverse()
            .map(({ r, i }) => (
              <WeightsEditor
                key={r}
                value={al.regimePortfolios[i]!}
                onChange={(w) => up((d) => void (d.allocation.regimePortfolios[i] = w))}
                title={
                  <span className="we-title">
                    <span className="dot" style={{ background: regimeColors[i] }} aria-hidden="true" />
                    {r}
                  </span>
                }
              />
            ))
        ) : (
          <>
            <div className="row-2">
              <NumberInput label="Score at min equity" value={al.continuous.scoreLow} min={0} max={100} onChange={(v) => up((d) => void (d.allocation.continuous.scoreLow = v))} />
              <NumberInput label="Score at max equity" value={al.continuous.scoreHigh} min={0} max={100} onChange={(v) => up((d) => void (d.allocation.continuous.scoreHigh = v))} />
              <NumberInput label="Min equity" value={al.continuous.minEquity} scale={100} suffix="%" step={10} min={0} onChange={(v) => up((d) => void (d.allocation.continuous.minEquity = Math.max(0, v)))} />
              <NumberInput label="Max equity" value={al.continuous.maxEquity} scale={100} suffix="%" step={10} min={0} max={300} onChange={(v) => up((d) => void (d.allocation.continuous.maxEquity = Math.max(0, v)))} hint="Above 100% the S&P 500 is blended with the leveraged ETF." />
            </div>
            <Select
              label="Leverage via"
              value={al.continuous.leveragedAsset}
              onChange={(v) => up((d) => void (d.allocation.continuous.leveragedAsset = v))}
              options={[
                { value: 'SSO', label: 'SSO (2x)' },
                { value: 'UPRO', label: 'UPRO (3x)' },
              ]}
            />
            <WeightsEditor value={al.continuous.defensive} onChange={(w) => up((d) => void (d.allocation.continuous.defensive = w))} title={<span className="we-title">Defensive mix</span>} />
          </>
        )}
      </Section>

      <Section title="Adaptive hedge (stock-bond correlation)">
        <Toggle
          label="Swap Treasuries out when stocks and bonds move together"
          checked={!!al.adaptiveHedge?.enabled}
          onChange={(v) => up((d) => void (d.allocation.adaptiveHedge = { ...(d.allocation.adaptiveHedge ?? DEFAULT_PARAMS.allocation.adaptiveHedge!), enabled: v }))}
          title="When the trailing correlation of S&P 500 and 7-10y Treasury daily returns is above the threshold, IEF/TLT/AGG in every target portfolio are replaced by the chosen asset."
        />
        {al.adaptiveHedge?.enabled && (
          <div className="row-2" style={{ marginTop: 8 }}>
            <NumberInput label="Correlation window (days)" value={al.adaptiveHedge.lookback} min={20} step={21} onChange={(v) => up((d) => void (d.allocation.adaptiveHedge!.lookback = Math.max(20, Math.round(v))))} />
            <NumberInput label="Swap when corr >" value={al.adaptiveHedge.threshold} min={-1} max={1} step={0.1} onChange={(v) => up((d) => void (d.allocation.adaptiveHedge!.threshold = Math.min(1, Math.max(-1, v))))} />
            <Select
              label="Replace with"
              value={al.adaptiveHedge.replacement}
              onChange={(v) => up((d) => void (d.allocation.adaptiveHedge!.replacement = v))}
              options={(['BIL', 'SHY', 'GLD'] as const).map((k) => ({ value: k, label: assetLabel(k) }))}
            />
          </div>
        )}
        <p className="muted small" style={{ margin: '6px 0 0' }}>
          Treasuries hedge equities when the two are negatively correlated (2008, 2020) but not in inflation or rate shocks (2022). Off by default: the idea
          was prompted by 2022, so its backtest benefit is partly hindsight.
        </p>
      </Section>

      <Section title="Execution & costs">
        <div className="row-2">
          <Select
            label="Execution"
            value={params.backtest.lag}
            onChange={(v) => up((d) => void (d.backtest.lag = v))}
            options={[
              { value: 1, label: 'Next close (t+1)' },
              { value: 2, label: 't+2 close' },
              { value: 5, label: 't+5 close' },
            ]}
            hint="Signal at the close of t, trade at the close of t+lag."
          />
          <Select
            label="Rebalance"
            value={params.backtest.rebalance}
            onChange={(v) => up((d) => void (d.backtest.rebalance = v))}
            options={[
              { value: 'regime', label: 'On regime change' },
              { value: 'daily', label: 'Daily' },
              { value: 'weekly', label: 'Weekly' },
              { value: 'monthly', label: 'Monthly' },
            ]}
          />
          <NumberInput label="Cost per side" value={params.backtest.costBps} suffix="bp" min={0} step={1} onChange={(v) => up((d) => void (d.backtest.costBps = Math.max(0, v)))} />
          <NumberInput label="Drift band" value={params.backtest.band} scale={100} suffix="%" min={0} step={1} onChange={(v) => up((d) => void (d.backtest.band = Math.max(0, v)))} hint="Daily/weekly/monthly modes: skip trades unless some weight is off target by more than this." />
          <NumberInput label="Leverage financing spread" value={params.assets.financingSpread} scale={10000} suffix="bp" min={0} step={5} onChange={(v) => up((d) => void (d.assets.financingSpread = Math.max(0, v)))} hint="Over T-bills, applied to the borrowed exposure of synthetic leveraged ETFs." />
        </div>
        <details className="asset-costs">
          <summary className="small">Per-asset costs (bp per side)</summary>
          <p className="muted small">Override the cost for individual assets, e.g. wider spreads on leveraged ETFs. Blank = the cost above.</p>
          <div className="cost-grid">
            {STRATEGY_ASSETS.map((k) => (
              <label key={k} className="small">
                <span>{assetLabel(k)}</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  placeholder={String(params.backtest.costBps)}
                  value={params.backtest.assetCostBps?.[k] ?? ''}
                  onChange={(e) =>
                    up((d) => {
                      const m = { ...(d.backtest.assetCostBps ?? {}) };
                      const x = parseFloat(e.target.value);
                      if (Number.isFinite(x) && x >= 0) m[k] = x;
                      else delete m[k];
                      d.backtest.assetCostBps = m;
                    })
                  }
                />
              </label>
            ))}
          </div>
        </details>
        <Toggle label="Use synthetic leveraged ETFs for the whole period" checked={params.assets.alwaysSynthetic} onChange={(v) => up((d) => void (d.assets.alwaysSynthetic = v))} />
      </Section>

      <Section title="Benchmarks">
        <div className="row-2">
          <Select label="Equity" value={params.benchmarks.equity} onChange={(v) => up((d) => void (d.benchmarks.equity = v))} options={[{ value: 'SPX', label: 'S&P 500' }, { value: 'WORLD', label: 'MSCI World' }]} />
          <Select label="Bonds" value={params.benchmarks.bond} onChange={(v) => up((d) => void (d.benchmarks.bond = v))} options={[{ value: 'AGG', label: 'US Aggregate (AGG)' }, { value: 'IEF', label: 'Treasuries 7-10y (IEF)' }]} />
          <NumberInput label="Vol target" value={params.benchmarks.volTarget} scale={100} suffix="%" min={1} step={1} onChange={(v) => up((d) => void (d.benchmarks.volTarget = Math.max(0.01, v)))} />
          <NumberInput label="Vol lookback (days)" value={params.benchmarks.volLookback} min={5} step={1} onChange={(v) => up((d) => void (d.benchmarks.volLookback = Math.max(5, Math.round(v))))} />
        </div>
      </Section>
    </div>
  );
}
