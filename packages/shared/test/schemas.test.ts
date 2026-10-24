import {
  dayEntryFields,
  eventExceptionRow,
  eventRow,
  habitScheduleRow,
  mutationSchema,
  plannerFields,
  pushRequestSchema,
  taskFields,
  weeklyTodoRow,
  weekNoteFields,
} from '../src';

const ID = '0192e000-0000-7000-8000-000000000001';
const PLANNER = '0192e000-0000-7000-8000-000000000002';
const STAMP = '1729771200000:0000:devA';

function issues(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.success ? [] : result.error!.issues.map((i) => i.message);
}

describe('field schemas', () => {
  it('limits focus to one line of 200 characters (A5)', () => {
    const base = { date: '2025-06-09', note: null, deleted: false };
    expect(dayEntryFields.safeParse({ ...base, focus: 'weekly cleaning chores' }).success).toBe(true);
    expect(dayEntryFields.safeParse({ ...base, focus: 'x'.repeat(201) }).success).toBe(false);
    expect(dayEntryFields.safeParse({ ...base, focus: 'two\nlines' }).success).toBe(false);
  });

  it('enforces title and note limits (Q1)', () => {
    const task = { date: '2025-06-09', title: 'x'.repeat(200), done: false, position: 'a0', perDay: null, spanDays: null, deleted: false };
    expect(taskFields.safeParse(task).success).toBe(true);
    expect(taskFields.safeParse({ ...task, title: 'x'.repeat(201) }).success).toBe(false);
    expect(taskFields.safeParse({ ...task, title: '   ' }).success).toBe(false);
    expect(weekNoteFields.safeParse({ weekKey: '2025-06-09', body: 'x'.repeat(10_001), deleted: false }).success).toBe(false);
  });

  it('requires week keys to be Mondays', () => {
    expect(weekNoteFields.safeParse({ weekKey: '2025-06-10', body: null, deleted: false }).success).toBe(false);
  });

  it('rejects unknown fields', () => {
    expect(taskFields.partial().safeParse({ title: 'ok', budget: 150 }).success).toBe(false);
  });

  it('validates planner settings', () => {
    expect(plannerFields.safeParse({ name: 'Home', weekStartDay: 7, dayColors: { '1': '#F6C89F' } }).success).toBe(true);
    expect(plannerFields.safeParse({ name: 'Home', weekStartDay: 3, dayColors: {} }).success).toBe(false);
    expect(plannerFields.safeParse({ name: 'x'.repeat(61), weekStartDay: 1, dayColors: {} }).success).toBe(false);
  });
});

describe('target fields (J1–J13)', () => {
  const schedule = {
    id: ID,
    plannerId: PLANNER,
    habitId: ID,
    effectiveFrom: '2025-06-09',
    weekdays: 0b0010101, // Mon, Wed, Fri
    targetType: null,
    perDay: null,
    daysPerWeek: null,
    timesPerWeek: null,
    deleted: false,
  };

  it('accepts habit schedules with consistent targets', () => {
    expect(habitScheduleRow.safeParse(schedule).success).toBe(true);
    expect(habitScheduleRow.safeParse({ ...schedule, targetType: 'days_per_week', daysPerWeek: 3 }).success).toBe(true);
    expect(habitScheduleRow.safeParse({ ...schedule, targetType: 'times_per_day', perDay: 8 }).success).toBe(true);
  });

  it('rejects inconsistent or over-limit targets', () => {
    expect(issues(habitScheduleRow.safeParse({ ...schedule, targetType: 'days_per_week', daysPerWeek: 4 }))).toContain(
      'TARGET_DAYS_EXCEED_COUNTABLE',
    );
    expect(issues(habitScheduleRow.safeParse({ ...schedule, targetType: 'times_per_week' }))).toContain('TARGET_FIELD_REQUIRED');
    expect(habitScheduleRow.safeParse({ ...schedule, targetType: 'times_per_day', perDay: 21 }).success).toBe(false);
    expect(habitScheduleRow.safeParse({ ...schedule, targetType: 'times_per_week', timesPerWeek: 101 }).success).toBe(false);
  });

  it('limits a spread day task to 2–31 days and 1–20 times a day', () => {
    const task = { date: '2025-06-09', title: 'antibiotic', done: false, position: 'a0', perDay: 3, spanDays: 5, deleted: false };
    expect(taskFields.safeParse(task).success).toBe(true);
    expect(taskFields.safeParse({ ...task, spanDays: 1 }).success).toBe(false);
    expect(taskFields.safeParse({ ...task, spanDays: 32 }).success).toBe(false);
    expect(taskFields.safeParse({ ...task, perDay: 21 }).success).toBe(false);
  });

  it('lets weekly to-dos use the four target types over 7 days', () => {
    const todo = {
      id: ID,
      plannerId: PLANNER,
      weekKey: '2025-06-09',
      title: 'call mum',
      done: false,
      position: 'a0',
      targetType: 'times_per_week',
      perDay: null,
      daysPerWeek: null,
      timesPerWeek: 3,
      deleted: false,
    };
    expect(weeklyTodoRow.safeParse(todo).success).toBe(true);
    expect(
      issues(weeklyTodoRow.safeParse({ ...todo, targetType: 'days_per_week', timesPerWeek: null, daysPerWeek: 8 })).length,
    ).toBeGreaterThan(0);
  });

  it('syncs completions as their own entity', () => {
    const m = {
      entityType: 'completion',
      id: ID,
      plannerId: PLANNER,
      fields: { itemType: 'habit', itemId: ID, date: '2025-06-09', deleted: false },
      clocks: { itemType: STAMP, itemId: STAMP, date: STAMP, deleted: STAMP },
    };
    expect(mutationSchema.safeParse(m).success).toBe(true);
    expect(mutationSchema.safeParse({ ...m, fields: { ...m.fields, itemType: 'event' } }).success).toBe(false);
  });
});

describe('event invariants', () => {
  const timed = {
    id: ID,
    plannerId: PLANNER,
    title: 'vet appointment',
    startDate: '2025-06-11',
    allDay: false,
    startTime: '16:30',
    endTime: null,
    recurrenceFreq: null,
    recurrenceWeekdays: null,
    recurrenceUntil: null,
    recurrenceCount: null,
    deleted: false,
  };

  it('accepts timed and all-day events', () => {
    expect(eventRow.safeParse(timed).success).toBe(true);
    expect(eventRow.safeParse({ ...timed, endTime: '17:30' }).success).toBe(true);
    expect(eventRow.safeParse({ ...timed, allDay: true, startTime: null }).success).toBe(true);
  });

  it('requires the end to be after the start on the same day (Q8)', () => {
    expect(issues(eventRow.safeParse({ ...timed, endTime: '16:00' }))).toContain('END_NOT_AFTER_START');
  });

  it('checks all-day and recurrence consistency', () => {
    expect(issues(eventRow.safeParse({ ...timed, allDay: true }))).toContain('ALL_DAY_HAS_TIMES');
    expect(issues(eventRow.safeParse({ ...timed, startTime: null }))).toContain('START_TIME_REQUIRED');
    expect(issues(eventRow.safeParse({ ...timed, recurrenceFreq: 'weekly' }))).toContain('WEEKLY_REQUIRES_WEEKDAYS');
    expect(
      issues(eventRow.safeParse({ ...timed, recurrenceFreq: 'daily', recurrenceUntil: '2025-07-01', recurrenceCount: 3 })),
    ).toContain('UNTIL_AND_COUNT');
    expect(issues(eventRow.safeParse({ ...timed, recurrenceCount: 3 }))).toContain('END_WITHOUT_RECURRENCE');
  });

  it('requires a full snapshot for non-cancelled exceptions', () => {
    const ex = {
      id: ID,
      plannerId: PLANNER,
      eventId: ID,
      originalDate: '2025-06-11',
      cancelled: true,
      title: null,
      date: null,
      allDay: null,
      startTime: null,
      endTime: null,
      deleted: false,
    };
    expect(eventExceptionRow.safeParse(ex).success).toBe(true);
    expect(issues(eventExceptionRow.safeParse({ ...ex, cancelled: false }))).toContain('SNAPSHOT_INCOMPLETE');
  });
});

describe('sync DTOs', () => {
  const mutation = {
    entityType: 'task',
    id: ID,
    plannerId: PLANNER,
    fields: { done: true },
    clocks: { done: STAMP },
  };

  it('accepts a valid mutation', () => {
    expect(mutationSchema.safeParse(mutation).success).toBe(true);
  });

  it('requires one clock per field', () => {
    expect(issues(mutationSchema.safeParse({ ...mutation, clocks: {} }))).toContain('CLOCKS_DO_NOT_MATCH_FIELDS');
  });

  it('validates field values against the entity schema', () => {
    expect(mutationSchema.safeParse({ ...mutation, fields: { done: 'yes' }, clocks: { done: STAMP } }).success).toBe(false);
    expect(mutationSchema.safeParse({ ...mutation, fields: { plannerId: PLANNER }, clocks: { plannerId: STAMP } }).success).toBe(false);
  });

  it('caps push batches at 500 mutations', () => {
    const many = Array.from({ length: 501 }, () => mutation);
    expect(pushRequestSchema.safeParse({ nodeId: 'devA', mutations: many }).success).toBe(false);
    expect(pushRequestSchema.safeParse({ nodeId: 'devA', mutations: [mutation] }).success).toBe(true);
  });
});
