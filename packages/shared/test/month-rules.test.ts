import { eventIssues, occurrenceDates } from '../src';

const base = {
  id: 'e',
  title: 'x',
  allDay: true,
  startTime: null,
  endTime: null,
  recurrenceWeekdays: null,
  recurrenceCount: null,
};
const monthEnd = (startDate: string, x: number, every = 1, until = '2028-12-31') => ({
  ...base,
  startDate,
  recurrenceFreq: 'month_end' as const,
  recurrenceDaysBeforeEnd: x,
  recurrenceIntervalMonths: every,
  recurrenceUntil: until,
});
const weekend = (startDate: string, day: number, every = 1, until = '2028-12-31') => ({
  ...base,
  startDate,
  recurrenceFreq: 'first_weekend' as const,
  recurrenceWeekendDay: day,
  recurrenceIntervalMonths: every,
  recurrenceUntil: until,
});

describe('month rules (A13)', () => {
  it('counts X days back from the last day of each month', () => {
    expect(occurrenceDates(monthEnd('2027-01-01', 3), '2027-01-01', '2027-04-30')).toEqual([
      '2027-01-28',
      '2027-02-25',
      '2027-03-28',
      '2027-04-27',
    ]);
    expect(occurrenceDates(monthEnd('2028-02-01', 0), '2028-02-01', '2028-02-29')).toEqual(['2028-02-29']);
  });

  it('starts next month when the date has passed, and steps every N months from there', () => {
    expect(occurrenceDates(monthEnd('2027-01-30', 3, 2), '2027-01-01', '2027-07-31')).toEqual([
      '2027-02-25',
      '2027-04-27',
      '2027-06-27',
    ]);
  });

  it('stops at the end date, across a year end', () => {
    expect(occurrenceDates(monthEnd('2026-11-01', 0, 1, '2027-01-31'), '2026-01-01', '2028-01-01')).toEqual([
      '2026-11-30',
      '2026-12-31',
      '2027-01-31',
    ]);
    expect(occurrenceDates(monthEnd('2026-11-01', 0, 1, '2027-01-30'), '2026-01-01', '2028-01-01')).toEqual([
      '2026-11-30',
      '2026-12-31',
    ]);
  });

  it('uses the first full weekend: a Sunday the 1st does not count', () => {
    // November 2026 starts on a Sunday; August 2026 on a Saturday.
    expect(occurrenceDates(weekend('2026-11-01', 6), '2026-11-01', '2026-11-30')).toEqual(['2026-11-07']);
    expect(occurrenceDates(weekend('2026-11-01', 7), '2026-11-01', '2026-11-30')).toEqual(['2026-11-08']);
    expect(occurrenceDates(weekend('2026-08-01', 6), '2026-08-01', '2026-08-31')).toEqual(['2026-08-01']);
    expect(occurrenceDates(weekend('2026-08-01', 7), '2026-08-01', '2026-08-31')).toEqual(['2026-08-02']);
  });

  it('steps first weekends every N months', () => {
    expect(occurrenceDates(weekend('2026-11-08', 6, 3), '2026-11-01', '2027-06-30')).toEqual([
      '2026-12-05',
      '2027-03-06',
      '2027-06-05',
    ]);
  });

  it('requires an end date and the fields of the rule', () => {
    const row = {
      title: 'x',
      startDate: '2026-11-01',
      allDay: true,
      startTime: null,
      endTime: null,
      recurrenceFreq: 'month_end' as 'month_end' | 'daily',
      recurrenceWeekdays: null,
      recurrenceUntil: '2027-01-01' as string | null,
      recurrenceCount: null,
      recurrenceIntervalMonths: 1 as number | null,
      recurrenceDaysBeforeEnd: 3 as number | null,
      recurrenceWeekendDay: null,
      deleted: false,
    };
    expect(eventIssues(row)).toEqual([]);
    expect(eventIssues({ ...row, recurrenceUntil: null })).toContain('END_DATE_REQUIRED');
    expect(eventIssues({ ...row, recurrenceDaysBeforeEnd: null })).toContain('RULE_FIELD_REQUIRED');
    expect(eventIssues({ ...row, recurrenceFreq: 'daily' })).toContain('RULE_FIELD_UNEXPECTED');
  });
});
