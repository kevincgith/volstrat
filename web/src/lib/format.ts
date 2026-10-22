/** Display formatting helpers shared across pages. Return an en dash for missing values. */

const DASH = '–';

export function fmtPct(x: number | null | undefined, digits = 1): string {
  if (x == null || !Number.isFinite(x)) return DASH;
  return `${(x * 100).toFixed(digits)}%`;
}

export function fmtNum(x: number | null | undefined, digits = 2): string {
  if (x == null || !Number.isFinite(x)) return DASH;
  return x.toFixed(digits);
}

export function fmtBps(x: number | null | undefined): string {
  if (x == null || !Number.isFinite(x)) return DASH;
  return `${Math.round(x * 10_000)} bp`;
}
