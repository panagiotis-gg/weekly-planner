import {
  dailyGoal,
  evaluateTarget,
  isCheckboxTarget,
  NO_TARGET,
  Target,
  targetIssues,
  taskDates,
  taskDayMet,
  taskOccursOn,
  taskSpanPosition,
  weekRange,
} from '../src';

const week = weekRange('2025-06-09', 1).days; // Mon 9 … Sun 15
const counts = (entries: Record<string, number>) => new Map(Object.entries(entries));
const target = (t: Partial<Target>): Target => ({ ...NO_TARGET, ...t });

describe('targetIssues', () => {
  it('requires exactly the fields of each type', () => {
    expect(targetIssues(NO_TARGET)).toEqual([]);
    expect(targetIssues(target({ targetType: 'days_per_week', daysPerWeek: 3 }))).toEqual([]);
    expect(targetIssues(target({ targetType: 'times_per_week', timesPerWeek: 5 }))).toEqual([]);
    expect(targetIssues(target({ targetType: 'times_per_day', perDay: 8 }))).toEqual([]);
    expect(targetIssues(target({ targetType: 'times_per_day_on_days', perDay: 2, daysPerWeek: 4 }))).toEqual([]);
    expect(targetIssues(target({ targetType: 'days_per_week' }))).toContain('TARGET_FIELD_REQUIRED');
    expect(targetIssues(target({ targetType: 'times_per_week', timesPerWeek: 5, perDay: 2 }))).toContain('TARGET_FIELD_UNEXPECTED');
    expect(targetIssues(target({ perDay: 2 }))).toContain('TARGET_FIELD_UNEXPECTED');
  });

  it("can't ask for more days than can count", () => {
    expect(targetIssues(target({ targetType: 'days_per_week', daysPerWeek: 4 }), 3)).toContain('TARGET_DAYS_EXCEED_COUNTABLE');
    expect(targetIssues(target({ targetType: 'days_per_week', daysPerWeek: 3 }), 3)).toEqual([]);
  });
});

describe('cell kind', () => {
  it('uses a checkbox when once a day is enough and days are counted', () => {
    expect(isCheckboxTarget(NO_TARGET)).toBe(true);
    expect(isCheckboxTarget(target({ targetType: 'days_per_week', daysPerWeek: 3 }))).toBe(true);
    expect(isCheckboxTarget(target({ targetType: 'times_per_week', timesPerWeek: 5 }))).toBe(false);
    expect(isCheckboxTarget(target({ targetType: 'times_per_day', perDay: 8 }))).toBe(false);
    expect(dailyGoal(target({ targetType: 'times_per_day_on_days', perDay: 2, daysPerWeek: 4 }))).toBe(2);
  });
});

describe('evaluateTarget', () => {
  it('A: days per week counts different days, not extra taps', () => {
    const e = evaluateTarget(target({ targetType: 'days_per_week', daysPerWeek: 3 }), week, counts({ '2025-06-09': 3, '2025-06-11': 1 }));
    expect(e).toMatchObject({ percent: 67, achieved: false, summary: { unit: 'days', value: 2, goal: 3 } });
  });

  it('A: achieved and capped at 100% when over-achieved (J8)', () => {
    const e = evaluateTarget(
      target({ targetType: 'days_per_week', daysPerWeek: 2 }),
      week,
      counts({ '2025-06-09': 1, '2025-06-10': 1, '2025-06-11': 1 }),
    );
    expect(e).toMatchObject({ percent: 100, achieved: true, summary: { value: 3, goal: 2 } });
  });

  it('B: times per week sums all taps with no per-day cap (J9)', () => {
    const e = evaluateTarget(target({ targetType: 'times_per_week', timesPerWeek: 5 }), week, counts({ '2025-06-09': 4, '2025-06-13': 1 }));
    expect(e).toMatchObject({ percent: 100, achieved: true, summary: { unit: 'times', value: 5, goal: 5 } });
    const partial = evaluateTarget(target({ targetType: 'times_per_week', timesPerWeek: 10 }), week, counts({ '2025-06-09': 3 }));
    expect(partial).toMatchObject({ percent: 30, achieved: false });
  });

  it('C: times per day must be met on every countable day, with partial credit', () => {
    const countable = week.slice(0, 2); // Mon, Tue
    const e = evaluateTarget(target({ targetType: 'times_per_day', perDay: 8 }), countable, counts({ '2025-06-09': 8, '2025-06-10': 4 }));
    // credit (8 + 4) / 16 = 75%; only Monday met
    expect(e).toMatchObject({ percent: 75, achieved: false, summary: { unit: 'days', value: 1, goal: 2 } });
    expect(e.days).toEqual([
      { date: '2025-06-09', count: 8, met: true },
      { date: '2025-06-10', count: 4, met: false },
    ]);
    const over = evaluateTarget(target({ targetType: 'times_per_day', perDay: 2 }), countable, counts({ '2025-06-09': 5, '2025-06-10': 2 }));
    expect(over).toMatchObject({ percent: 100, achieved: true }); // extra taps don't count twice
  });

  it('D: times per day on N days credits only the best N days', () => {
    const t = target({ targetType: 'times_per_day_on_days', perDay: 2, daysPerWeek: 3 });
    const e = evaluateTarget(t, week, counts({ '2025-06-09': 2, '2025-06-10': 1, '2025-06-11': 1, '2025-06-12': 1 }));
    // best 3 days: 2 + 1 + 1 = 4 of 6 → 67%; met days: 1 of 3
    expect(e).toMatchObject({ percent: 67, achieved: false, summary: { value: 1, goal: 3 } });
    const done = evaluateTarget(t, week, counts({ '2025-06-09': 2, '2025-06-10': 2, '2025-06-14': 3 }));
    expect(done).toMatchObject({ percent: 100, achieved: true });
  });

  it('no target: each countable day once, achieved is null', () => {
    const e = evaluateTarget(NO_TARGET, week.slice(0, 4), counts({ '2025-06-09': 2 }));
    expect(e).toMatchObject({ percent: 25, achieved: null });
  });

  it('nothing countable gives a null percent', () => {
    expect(evaluateTarget(NO_TARGET, [], counts({})).percent).toBeNull();
  });
});

describe('spread day tasks (J4)', () => {
  const task = { date: '2025-06-13', perDay: 3, spanDays: 5 }; // Fri 13 … Tue 17, crosses the week

  it('lists the dates of its span', () => {
    expect(taskDates(task)).toEqual(['2025-06-13', '2025-06-14', '2025-06-15', '2025-06-16', '2025-06-17']);
    expect(taskDates({ date: '2025-06-13', perDay: null, spanDays: null })).toEqual(['2025-06-13']);
  });

  it('knows which days it appears on and its position', () => {
    expect(taskOccursOn(task, '2025-06-12')).toBe(false);
    expect(taskOccursOn(task, '2025-06-16')).toBe(true);
    expect(taskOccursOn(task, '2025-06-18')).toBe(false);
    expect(taskSpanPosition(task, '2025-06-14')).toEqual({ day: 2, of: 5 });
  });

  it('a day is met when its count reaches the per-day goal', () => {
    expect(taskDayMet(task, 2)).toBe(false);
    expect(taskDayMet(task, 3)).toBe(true);
    expect(taskDayMet({ date: '2025-06-13', perDay: null, spanDays: null }, 1)).toBe(true);
  });
});
