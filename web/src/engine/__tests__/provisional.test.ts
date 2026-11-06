import { describe, expect, it } from 'vitest';
import { officialData, truncateTo } from '../data';
import { makeFixture } from './fixture';

describe('official vs provisional data', () => {
  const d = makeFixture(300);
  const last = d.dates.at(-1)!;
  const official = d.dates.at(-3)!;

  it('truncateTo cuts every series and asset at the date, inclusive', () => {
    const t = truncateTo(d, official);
    expect(t.dates.at(-1)).toBe(official);
    expect(t.dates.length).toBe(d.dates.length - 2);
    for (const v of Object.values(t.series)) expect(v.length).toBe(t.dates.length);
    for (const a of Object.values(t.assets)) expect(a.tr.length).toBe(t.dates.length);
    expect(t.series.SPX![t.dates.length - 1]).toBe(d.series.SPX![t.dates.length - 1]);
  });

  it('officialData drops provisional dates and leaves complete data alone', () => {
    expect(officialData({ ...d, meta: { ...d.meta, complete_through: official } }).dates.at(-1)).toBe(official);
    expect(officialData({ ...d, meta: { ...d.meta, complete_through: last } })).toEqual({ ...d, meta: { ...d.meta, complete_through: last } });
    expect(officialData({ ...d, meta: { ...d.meta, complete_through: undefined } }).dates.at(-1)).toBe(last);
  });
});
