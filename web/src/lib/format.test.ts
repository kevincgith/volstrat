import { describe, expect, it } from 'vitest';
import { fmtBps, fmtNum, fmtPct } from './format';

describe('format helpers', () => {
  it('formats percentages', () => {
    expect(fmtPct(0.1234)).toBe('12.3%');
    expect(fmtPct(-0.05, 2)).toBe('-5.00%');
  });
  it('formats numbers and basis points', () => {
    expect(fmtNum(1.23456)).toBe('1.23');
    expect(fmtBps(0.0025)).toBe('25 bp');
  });
  it('renders missing or non-finite values as an en dash', () => {
    for (const v of [null, undefined, NaN, Infinity]) {
      expect(fmtPct(v)).toBe('–');
      expect(fmtNum(v)).toBe('–');
      expect(fmtBps(v)).toBe('–');
    }
  });
});
