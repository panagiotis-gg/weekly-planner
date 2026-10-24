import {
  checklistProgress,
  CompletionLike,
  habitProgress,
  habitWeekGrid,
  HabitLike,
  HabitScheduleLike,
  maskFromWeekdays,
  percent,
  scheduleForWeek,
  weekRange,
} from '../src';

describe('percent', () => {
  it('rounds to whole numbers', () => {
    expect(percent(5, 11)).toBe(45);
    expect(percent(7, 9)).toBe(78); // spreadsheet showed 77.8%
    expect(percent(0, 3)).toBe(0);
  });

  it('is null when there is nothing to count', () => {
    expect(percent(0, 0)).toBeNull();
  });
});

describe('checklistProgress', () => {
  it('counts checked ÷ total and ignores deleted items', () => {
    const p = checklistProgress([
      { done: true },
      { done: false },
      { done: true, deleted: true },
      { done: false },
    ]);
    expect(p).toEqual({ done: 1, total: 3, percent: 33 });
  });

  it('gives partial credit to items with a target (J5)', () => {
    // 1/3 done target item + a checked item + an unchecked item → (1/3 + 1 + 0) / 3 = 44%
    const p = checklistProgress([{ done: false, fraction: 1 / 3 }, { done: true }, { done: false }]);
    expect(p).toEqual({ done: 1, total: 3, percent: 44 });
  });
});

/** n completion records for a habit on a date. */
const taps = (itemId: string, date: string, n: number): CompletionLike[] =>
  Array.from({ length: n }, () => ({ itemId, date }));

describe('habits', () => {
  const week = weekRange('2025-06-09', 1);
  const habits: HabitLike[] = [
    { id: 'sleep', startsOn: '2025-06-02', endsOn: null },
    { id: 'walk', startsOn: '2025-06-09', endsOn: null },
    { id: 'old', startsOn: '2025-05-05', endsOn: '2025-06-02' }, // stopped before this week
    { id: 'gone', startsOn: '2025-06-02', endsOn: null, deleted: true },
    { id: 'future', startsOn: '2025-06-16', endsOn: null },
  ];
  const schedules: HabitScheduleLike[] = [
    { habitId: 'sleep', effectiveFrom: '2025-06-02', weekdays: 127 },
    { habitId: 'walk', effectiveFrom: '2025-06-09', weekdays: maskFromWeekdays([1, 3, 5]) },
    { habitId: 'walk', effectiveFrom: '2025-06-16', weekdays: 127 }, // later edit doesn't affect this week
  ];

  it('picks the schedule version effective for the week', () => {
    expect(scheduleForWeek('walk', schedules, '2025-06-09')).toBe(0b10101);
    expect(scheduleForWeek('walk', schedules, '2025-06-23')).toBe(127);
    expect(scheduleForWeek('walk', schedules, '2025-06-02')).toBeNull();
  });

  it('shows only habits active that week', () => {
    const rows = habitWeekGrid(habits, schedules, [], week);
    expect(rows.map((r) => r.habitId)).toEqual(['sleep', 'walk']);
  });

  it('without targets: each selected day counts once; unselected and deleted taps are ignored', () => {
    const rows = habitWeekGrid(
      habits,
      schedules,
      [
        ...taps('sleep', '2025-06-09', 1),
        ...taps('sleep', '2025-06-10', 2), // twice still counts once without a target
        ...taps('walk', '2025-06-09', 1),
        ...taps('walk', '2025-06-10', 1), // Tuesday: not selected
        { itemId: 'walk', date: '2025-06-11', deleted: true },
      ],
      week,
    );
    expect(rows[0]!.evaluation).toMatchObject({ percent: 29, achieved: null }); // 2/7
    expect(rows[1]!.evaluation).toMatchObject({ percent: 33, achieved: null }); // 1/3
    expect(rows[1]!.days[1]).toEqual({ date: '2025-06-10', scheduled: false, count: 1, met: false });
  });

  it('overall % is the average of the habits (J10)', () => {
    const rows = habitWeekGrid(habits, schedules, [...taps('sleep', '2025-06-09', 1), ...taps('walk', '2025-06-09', 1)], week);
    // sleep 1/7 = 14%, walk 1/3 = 33% → average 24% (habit-days would give 2/10 = 20%)
    expect(habitProgress(rows)).toEqual({ done: 0, total: 2, percent: 24 });
  });

  it('applies the target version effective for the week', () => {
    const withTarget: HabitScheduleLike[] = [
      { habitId: 'sleep', effectiveFrom: '2025-06-02', weekdays: 127, targetType: 'days_per_week', daysPerWeek: 2 },
    ];
    const rows = habitWeekGrid(
      [habits[0]!],
      withTarget,
      [...taps('sleep', '2025-06-09', 1), ...taps('sleep', '2025-06-12', 1)],
      week,
    );
    expect(rows[0]!.evaluation).toMatchObject({ percent: 100, achieved: true, summary: { unit: 'days', value: 2, goal: 2 } });
    expect(habitProgress(rows)).toEqual({ done: 1, total: 1, percent: 100 });
  });
});
