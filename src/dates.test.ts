import {
  addDaysYmd,
  calendarDateToYmd,
  defaultDueYmd,
  parseCalendarDate,
  todayYmd,
  toYmd,
  ymdToLocalDate,
} from './dates';

describe('local calendar dates', () => {
  test('toYmd uses local components, not UTC', () => {
    const local = new Date(2026, 7, 28, 0, 30, 0);
    expect(toYmd(local)).toBe('2026-08-28');
    // In Australia this local midnight is the previous UTC date.
    expect(local.toISOString().slice(0, 10) === '2026-08-28' || local.getTimezoneOffset() < 0).toBe(true);
  });

  test('YYYY-MM-DD does not shift when parsed locally', () => {
    const date = ymdToLocalDate('2026-08-28');
    expect(date).toBeInstanceOf(Date);
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(7);
    expect(date?.getDate()).toBe(28);
  });

  test('UTC ISO midnight is not treated as a calendar day in the US evening case', () => {
    // The old bug: store toISOString(), then new Date(iso) and read UTC date.
    const evening = new Date(2026, 7, 28, 22, 0, 0);
    const iso = evening.toISOString();
    const utcDay = iso.slice(0, 10);
    const localDay = toYmd(evening);
    expect(localDay).toBe('2026-08-28');
    if (evening.getTimezoneOffset() > 0) {
      expect(utcDay).not.toBe(localDay);
    }
    expect(calendarDateToYmd(evening)).toBe('2026-08-28');
  });

  test('parseCalendarDate reads YYYY-MM-DD as local', () => {
    const date = parseCalendarDate('2026-01-31');
    expect(date?.getDate()).toBe(31);
    expect(date?.getMonth()).toBe(0);
  });

  test('rejects Invalid Date and empty', () => {
    expect(parseCalendarDate('')).toBeNull();
    expect(parseCalendarDate('Invalid Date')).toBeNull();
    expect(parseCalendarDate(null)).toBeNull();
  });

  test('invoice due date is issue plus 30 local days', () => {
    expect(defaultDueYmd('2026-01-31')).toBe('2026-03-02');
    expect(addDaysYmd('2026-08-28', 14)).toBe('2026-09-11');
  });

  test('todayYmd matches local now', () => {
    const now = new Date(2026, 11, 31, 23, 45, 0);
    expect(todayYmd(now)).toBe('2026-12-31');
  });
});
