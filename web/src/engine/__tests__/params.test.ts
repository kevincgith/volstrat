import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compressToEncodedURIComponent } from 'lz-string';
import { describe, expect, it } from 'vitest';
import { BASE_PARAMS, decodeParams, DEFAULT_PARAMS, encodeParams, merge, presetParams } from '../params';

describe('defaults, presets and frozen track records', () => {
  it('Growth is the default; Balanced is the all-off base', () => {
    expect(presetParams('growth')).toEqual(DEFAULT_PARAMS);
    expect(presetParams('balanced')).toEqual(BASE_PARAMS);
    expect(DEFAULT_PARAMS.regime.rebound?.enabled).toBe(true);
    expect(DEFAULT_PARAMS.allocation.regimePortfolios[2]).toEqual({ SPX: 0.8, IEF: 0.2 });
    expect(BASE_PARAMS.regime.rebound?.enabled).toBe(false);
  });

  it('track record v1 resolves to exactly the Balanced parameters it was frozen with', () => {
    const file = JSON.parse(readFileSync(resolve(__dirname, '../../../../data/track/v1/params.json'), 'utf8'));
    expect(merge(BASE_PARAMS, file.params)).toEqual(BASE_PARAMS);
  });

  it('links encoded before the default change keep their meaning', () => {
    const legacy = compressToEncodedURIComponent(JSON.stringify({ score: { smoothing: 10 } }));
    expect(decodeParams(legacy)).toEqual(merge(BASE_PARAMS, { score: { smoothing: 10 } }));
    for (const p of [DEFAULT_PARAMS, BASE_PARAMS, merge(DEFAULT_PARAMS, { score: { smoothing: 7 } })]) {
      expect(decodeParams(encodeParams(p))).toEqual(p);
    }
    expect(encodeParams(DEFAULT_PARAMS)).toBe('');
  });
});
