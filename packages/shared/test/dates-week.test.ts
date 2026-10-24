import {
  addDays,
  isoWeekday,
  isValidIsoDate,
  maskFromWeekdays,
  maskIncludes,
  monthGrid,
  monthsSpanned,
  shiftWeek,
  weekdaysFromMask,
  weekKeyOf,
  weekRange,
  weekStartOf,
} from '../src';

describe('dates', () => {
  it('validates calendar dates', () => {
    expect(isValidIsoDate('2025-06-09')).toBe(true);
    expect(isValidIsoDate('2024-02-29')).toBe(true);
    expect(isValidIsoDate('2025-02-29')).toBe(false);
    expect(isValidIsoDate('2025-13-01')).toBe(false);
    expect(isValidIsoDate('2025-6-9')).toBe(false);
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2025-06-30', 1)).toBe('2025-07-01');
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
  });

  it('computes ISO weekdays', () => {
    expect(isoWeekday('2025-06-09')).toBe(1); // Monday (screenshot week start)
    expect(isoWeekday('2025-06-15')).toBe(7); // Sunday
  });

  it('round-trips weekday masks', () => {
    const mask = maskFromWeekdays([1, 3, 5]);
    expect(mask).toBe(0b10101);
    expect(maskIncludes(mask, 3)).toBe(true);
    expect(maskIncludes(mask, 2)).toBe(false);
    expect(weekdaysFromMask(mask)).toEqual([1, 3, 5]);
  });
});

describe('week math', () => {
  it('matches the screenshot week for a Monday start (Jun 9 – Jun 15, 2025)', () => {
    const key = weekKeyOf('2025-06-12', 1);
    expect(key).toBe('2025-06-09');
    const range = weekRange(key, 1);
    expect(range.start).toBe('2025-06-09');
    expect(range.end).toBe('2025-06-15');
    expect(range.days).toHaveLength(7);
  });

  it('uses the Monday inside the week as key for a Sunday start', () => {
    expect(weekStartOf('2025-06-12', 7)).toBe('2025-06-08');
    expect(weekKeyOf('2025-06-12', 7)).toBe('2025-06-09');
    expect(weekKeyOf('2025-06-08', 7)).toBe('2025-06-09'); // the Sunday itself
    const range = weekRange('2025-06-09', 7);
    expect(range.start).toBe('2025-06-08');
    expect(range.end).toBe('2025-06-14');
  });

  it('keeps the same key for a week when the planner switches start day', () => {
    // Every Monday-start week maps to the Sunday-start week beginning the day before.
    for (let i = 0; i < 60; i++) {
      const date = addDays('2025-01-01', i);
      const mondayKey = weekKeyOf(date, 1);
      expect(weekRange(mondayKey, 7).days).toContain(mondayKey);
    }
  });

  it('rejects non-Monday week keys', () => {
    expect(() => weekRange('2025-06-10', 1)).toThrow(RangeError);
  });

  it('shifts weeks', () => {
    expect(shiftWeek('2025-06-09', 1)).toBe('2025-06-16');
    expect(shiftWeek('2025-06-09', -2)).toBe('2025-05-26');
  });

  it('returns the months a week spans', () => {
    expect(monthsSpanned(weekRange('2025-06-09', 1))).toEqual([{ year: 2025, month: 6 }]);
    expect(monthsSpanned(weekRange('2025-06-30', 1))).toEqual([
      { year: 2025, month: 6 },
      { year: 2025, month: 7 },
    ]);
    expect(monthsSpanned(weekRange('2025-12-29', 1))).toEqual([
      { year: 2025, month: 12 },
      { year: 2026, month: 1 },
    ]);
  });

  it('builds a mini-calendar grid (June 2025 starts on a Sunday)', () => {
    const mon = monthGrid(2025, 6, 1);
    expect(mon[0]).toEqual([null, null, null, null, null, null, '2025-06-01']);
    expect(mon.at(-1)).toEqual(['2025-06-30', null, null, null, null, null, null]);
    const sun = monthGrid(2025, 6, 7);
    expect(sun[0]![0]).toBe('2025-06-01');
    expect(sun.every((row) => row.length === 7)).toBe(true);
  });
});
