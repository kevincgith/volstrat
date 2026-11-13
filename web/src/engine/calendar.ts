/**
 * NYSE full-day holidays (rules in force since 2022, when Juneteenth was added), for projecting
 * trading days past the last date in the data. Early closes are trading days.
 */

const ymd = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** n-th weekday (0 = Sunday) of a month; n = -1 for the last. */
function nthWeekday(y: number, m: number, weekday: number, n: number): Date {
  if (n > 0) {
    const first = ymd(y, m, 1);
    const offset = (weekday - first.getUTCDay() + 7) % 7;
    return ymd(y, m, 1 + offset + 7 * (n - 1));
  }
  const last = ymd(y, m + 1, 0);
  const back = (last.getUTCDay() - weekday + 7) % 7;
  return ymd(y, m, last.getUTCDate() - back);
}

/** Easter Sunday (Gregorian, anonymous algorithm). */
function easter(y: number): Date {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return ymd(y, month, day);
}

/** A fixed-date holiday falling on a weekend is observed on Friday (Saturday) or Monday (Sunday). */
function observed(d: Date): Date {
  const w = d.getUTCDay();
  if (w === 6) return new Date(d.getTime() - 86_400_000);
  if (w === 0) return new Date(d.getTime() + 86_400_000);
  return d;
}

const cache = new Map<number, Set<string>>();

export function nyseHolidays(y: number): Set<string> {
  let s = cache.get(y);
  if (s) return s;
  const days = [
    // New Year's Day: on a Saturday it is not moved to the previous Friday (NYSE rule)
    ...(ymd(y, 1, 1).getUTCDay() === 6 ? [] : [observed(ymd(y, 1, 1))]),
    nthWeekday(y, 1, 1, 3), // Martin Luther King Jr. Day
    nthWeekday(y, 2, 1, 3), // Washington's Birthday
    new Date(easter(y).getTime() - 2 * 86_400_000), // Good Friday
    nthWeekday(y, 5, 1, -1), // Memorial Day
    observed(ymd(y, 6, 19)), // Juneteenth
    observed(ymd(y, 7, 4)), // Independence Day
    nthWeekday(y, 9, 1, 1), // Labor Day
    nthWeekday(y, 11, 4, 4), // Thanksgiving
    observed(ymd(y, 12, 25)), // Christmas
  ];
  s = new Set(days.map(iso));
  cache.set(y, s);
  return s;
}

export function isTradingDay(isoDate: string): boolean {
  const d = new Date(isoDate + 'T00:00:00Z');
  const w = d.getUTCDay();
  return w !== 0 && w !== 6 && !nyseHolidays(d.getUTCFullYear()).has(isoDate);
}

/** The trading day `n` trading days after `isoDate` (n >= 0). */
export function addTradingDays(isoDate: string, n: number): string {
  const d = new Date(isoDate + 'T00:00:00Z');
  let k = 0;
  while (k < n) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (isTradingDay(iso(d))) k++;
  }
  return iso(d);
}
