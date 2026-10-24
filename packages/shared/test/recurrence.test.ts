import {
  EventExceptionLike,
  EventLike,
  expandEvent,
  expandEvents,
  isOccurrenceDate,
  maskFromWeekdays,
  occurrenceDates,
} from '../src';

function event(overrides: Partial<EventLike> = {}): EventLike {
  return {
    id: 'e1',
    title: 'team meeting',
    startDate: '2025-06-09',
    allDay: false,
    startTime: '09:30',
    endTime: null,
    recurrenceFreq: null,
    recurrenceWeekdays: null,
    recurrenceUntil: null,
    recurrenceCount: null,
    ...overrides,
  };
}

function exception(overrides: Partial<EventExceptionLike>): EventExceptionLike {
  return {
    eventId: 'e1',
    originalDate: '2025-06-10',
    cancelled: false,
    title: 'moved meeting',
    date: '2025-06-10',
    allDay: false,
    startTime: '11:00',
    endTime: null,
    ...overrides,
  };
}

describe('occurrence dates', () => {
  it('returns a single date for a one-off event', () => {
    expect(occurrenceDates(event(), '2025-06-01', '2025-06-30')).toEqual(['2025-06-09']);
    expect(occurrenceDates(event(), '2025-07-01', '2025-07-31')).toEqual([]);
  });

  it('repeats daily with a count', () => {
    const e = event({ recurrenceFreq: 'daily', recurrenceCount: 3 });
    expect(occurrenceDates(e, '2025-06-01', '2025-06-30')).toEqual(['2025-06-09', '2025-06-10', '2025-06-11']);
  });

  it('counts occurrences from the series start, not from the range', () => {
    const e = event({ recurrenceFreq: 'daily', recurrenceCount: 3 });
    expect(occurrenceDates(e, '2025-06-11', '2025-06-30')).toEqual(['2025-06-11']);
  });

  it('repeats on weekdays only', () => {
    const e = event({ startDate: '2025-06-13', recurrenceFreq: 'weekdays' }); // Friday
    expect(occurrenceDates(e, '2025-06-13', '2025-06-17')).toEqual(['2025-06-13', '2025-06-16', '2025-06-17']);
  });

  it('repeats weekly on chosen days until a date', () => {
    const e = event({
      recurrenceFreq: 'weekly',
      recurrenceWeekdays: maskFromWeekdays([2, 4]), // Tue, Thu
      recurrenceUntil: '2025-06-19',
    });
    expect(occurrenceDates(e, '2025-06-01', '2025-06-30')).toEqual([
      '2025-06-10',
      '2025-06-12',
      '2025-06-17',
      '2025-06-19',
    ]);
  });

  it('skips months without the day for monthly repeats (Q7)', () => {
    const e = event({ startDate: '2025-01-31', recurrenceFreq: 'monthly', recurrenceCount: 4 });
    expect(occurrenceDates(e, '2025-01-01', '2025-12-31')).toEqual([
      '2025-01-31',
      '2025-03-31',
      '2025-05-31',
      '2025-07-31',
    ]);
  });

  it('repeats yearly on Feb 29 only in leap years (Q7)', () => {
    const e = event({ startDate: '2024-02-29', recurrenceFreq: 'yearly' });
    expect(occurrenceDates(e, '2024-01-01', '2032-12-31')).toEqual(['2024-02-29', '2028-02-29', '2032-02-29']);
  });

  it('crosses year boundaries for monthly repeats', () => {
    const e = event({ startDate: '2025-11-15', recurrenceFreq: 'monthly', recurrenceCount: 3 });
    expect(occurrenceDates(e, '2025-01-01', '2026-12-31')).toEqual(['2025-11-15', '2025-12-15', '2026-01-15']);
  });

  it('checks whether a date is an occurrence', () => {
    const e = event({ recurrenceFreq: 'weekly', recurrenceWeekdays: maskFromWeekdays([1]) });
    expect(isOccurrenceDate(e, '2025-06-16')).toBe(true);
    expect(isOccurrenceDate(e, '2025-06-17')).toBe(false);
    expect(isOccurrenceDate(e, '2025-06-02')).toBe(false); // before start
  });
});

describe('expandEvent with exceptions', () => {
  const daily = event({ recurrenceFreq: 'daily' });

  it('cancels a single occurrence', () => {
    const occ = expandEvent(daily, [exception({ cancelled: true })], '2025-06-09', '2025-06-11');
    expect(occ.map((o) => o.date)).toEqual(['2025-06-09', '2025-06-11']);
  });

  it('replaces an occurrence with its snapshot', () => {
    const occ = expandEvent(daily, [exception({})], '2025-06-10', '2025-06-10');
    expect(occ).toHaveLength(1);
    expect(occ[0]).toMatchObject({ title: 'moved meeting', startTime: '11:00', isException: true });
  });

  it('moves an occurrence into the range from outside it', () => {
    const moved = exception({ originalDate: '2025-06-20', date: '2025-06-10', title: 'moved in' });
    const occ = expandEvent(daily, [moved], '2025-06-10', '2025-06-10');
    expect(occ.map((o) => o.title).sort()).toEqual(['moved in', 'team meeting']);
  });

  it('moves an occurrence out of the range', () => {
    const moved = exception({ originalDate: '2025-06-10', date: '2025-06-25' });
    expect(expandEvent(daily, [moved], '2025-06-10', '2025-06-10')).toEqual([]);
  });

  it('ignores exceptions whose original date is no longer an occurrence', () => {
    const limited = event({ recurrenceFreq: 'daily', recurrenceCount: 1 });
    const stale = exception({ originalDate: '2025-06-10', date: '2025-06-10' });
    expect(expandEvent(limited, [stale], '2025-06-10', '2025-06-10')).toEqual([]);
  });

  it('ignores exceptions on one-off events', () => {
    const occ = expandEvent(event(), [exception({ originalDate: '2025-06-09', cancelled: true })], '2025-06-09', '2025-06-09');
    expect(occ).toHaveLength(1);
  });
});

describe('expandEvents ordering', () => {
  it('sorts by date, all-day first, then start time', () => {
    const occ = expandEvents(
      [
        event({ id: 'a', title: 'doctor', startTime: '11:30' }),
        event({ id: 'b', title: 'birthday', allDay: true, startTime: null }),
        event({ id: 'c', title: 'standup', startTime: '09:30' }),
      ],
      [],
      '2025-06-09',
      '2025-06-09',
    );
    expect(occ.map((o) => o.title)).toEqual(['birthday', 'standup', 'doctor']);
  });
});
