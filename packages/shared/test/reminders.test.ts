import { joinOffset, reminderFireAt, splitOffset, weeklyTodoIssues, WeeklyTodoFields } from '../src';

describe('reminderFireAt', () => {
  it('counts back from the item time', () => {
    expect(reminderFireAt('2026-10-28', '14:30', 0)).toBe('2026-10-28T14:30');
    expect(reminderFireAt('2026-10-28', '14:30', 60)).toBe('2026-10-28T13:30');
    expect(reminderFireAt('2026-10-28', '14:30', 1440)).toBe('2026-10-27T14:30');
  });

  it('uses 09:00 when the item has no time (Q6, K4)', () => {
    expect(reminderFireAt('2026-10-28', null, 0)).toBe('2026-10-28T09:00');
    expect(reminderFireAt('2026-10-28', null, 60)).toBe('2026-10-28T08:00');
  });

  it('crosses midnight and month ends', () => {
    expect(reminderFireAt('2026-11-01', '00:30', 60)).toBe('2026-10-31T23:30');
    expect(reminderFireAt('2026-03-01', '00:00', 3 * 1440 + 1)).toBe('2026-02-25T23:59');
  });
});

describe('splitOffset / joinOffset', () => {
  it('uses the largest whole unit', () => {
    expect(splitOffset(0)).toEqual({ amount: 0, unit: 'minutes' });
    expect(splitOffset(90)).toEqual({ amount: 90, unit: 'minutes' });
    expect(splitOffset(120)).toEqual({ amount: 2, unit: 'hours' });
    expect(splitOffset(2880)).toEqual({ amount: 2, unit: 'days' });
    expect(joinOffset(2, 'hours')).toBe(120);
    expect(joinOffset(3, 'days')).toBe(4320);
  });
});

describe('weekly to-do due day (K5)', () => {
  const todo = (t: Partial<WeeklyTodoFields>): WeeklyTodoFields => ({
    weekKey: '2026-10-26',
    title: 'x',
    done: false,
    position: 'a0',
    targetType: null,
    perDay: null,
    daysPerWeek: null,
    timesPerWeek: null,
    dueDate: null,
    dueTime: null,
    deleted: false,
    ...t,
  });

  it('keeps the due day inside the week and needs it before a time', () => {
    expect(weeklyTodoIssues(todo({ dueDate: '2026-10-26' }))).toEqual([]);
    expect(weeklyTodoIssues(todo({ dueDate: '2026-11-01', dueTime: '18:00' }))).toEqual([]);
    expect(weeklyTodoIssues(todo({ dueDate: '2026-11-02' }))).toContain('DUE_DATE_OUTSIDE_WEEK');
    expect(weeklyTodoIssues(todo({ dueDate: '2026-10-25' }))).toContain('DUE_DATE_OUTSIDE_WEEK');
    expect(weeklyTodoIssues(todo({ dueTime: '18:00' }))).toContain('DUE_TIME_WITHOUT_DATE');
  });
});
