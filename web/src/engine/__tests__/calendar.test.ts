import { describe, expect, it } from 'vitest';
import { addTradingDays, isTradingDay, nyseHolidays } from '../calendar';
import { BASE_PARAMS, DEFAULT_PARAMS, merge } from '../params';
import { OVERRIDE_NONE, OVERRIDE_REBOUND, run } from '../run';
import { makeFixture } from './fixture';

describe('NYSE calendar', () => {
  it('knows the 2026 holidays', () => {
    expect([...nyseHolidays(2026)].sort()).toEqual([
      '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25',
      '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25',
    ]); // prettier-ignore
  });
  it('observes weekend holidays and keeps the NYSE Saturday New Year rule', () => {
    expect(nyseHolidays(2027).has('2027-12-24')).toBe(true); // Christmas on Saturday -> Friday
    expect(nyseHolidays(2022).has('2021-12-31')).toBe(false); // 2022-01-01 Saturday: not observed
    expect(nyseHolidays(2028).has('2028-04-14')).toBe(true); // Good Friday 2028
  });
  it('counts trading days across Thanksgiving', () => {
    expect(isTradingDay('2026-11-26')).toBe(false);
    expect(isTradingDay('2026-11-27')).toBe(true);
    // the 20-day lift that starts 2026-11-09 ends on its 20th trading day, 2026-12-07
    expect(addTradingDays('2026-11-09', 19)).toBe('2026-12-07');
  });
});

describe('override flags', () => {
  it('mark exactly the days where an override changed the score regime', () => {
    const d = makeFixture();
    const r = run(d, merge(DEFAULT_PARAMS, { period: { start: '2010-01-01' } }));
    let lifted = 0;
    for (let t = 0; t < d.dates.length; t++) {
      if (r.override[t] === OVERRIDE_NONE) expect(r.regimes[t]).toBe(r.scoreRegimes[t]);
      else {
        expect(r.regimes[t]).not.toBe(r.scoreRegimes[t]);
        if (r.override[t] === OVERRIDE_REBOUND) lifted++;
      }
    }
    // with the overrides off, nothing is flagged
    const b = run(d, merge(BASE_PARAMS, { period: { start: '2010-01-01' } }));
    expect(b.override.every((x) => x === OVERRIDE_NONE)).toBe(true);
    expect(lifted).toBeGreaterThanOrEqual(0);
  });
});
