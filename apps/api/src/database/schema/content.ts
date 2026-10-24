import { sql } from 'drizzle-orm';
import {
  AnyPgColumn,
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  time,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { TEXT_LIMITS } from '@planner/shared';
import { positionText, timestamps } from './columns';
import { users } from './identity';
import { planners } from './planners';

/** Columns shared by every synced content table (database-schema.md §1). */
const syncColumns = () => ({
  plannerId: uuid()
    .notNull()
    .references(() => planners.id, { onDelete: 'cascade' }),
  serverSeq: bigint({ mode: 'number' }).notNull(),
  fieldClocks: jsonb().$type<Record<string, string>>().notNull().default({}),
  deleted: boolean().notNull().default(false),
  ...timestamps(),
});

const feedIndex = (name: string, t: { plannerId: AnyPgColumn; serverSeq: AnyPgColumn }) =>
  index(`${name}_feed`).on(t.plannerId, t.serverSeq);

const isMonday = (col: AnyPgColumn) => sql`extract(isodow FROM ${col}) = 1`;

// ---- targets (DECISIONS J1–J13; mirrors targetIssues in @planner/shared) ----

const targetColumns = () => ({
  targetType: text(),
  perDay: smallint(),
  daysPerWeek: smallint(),
  timesPerWeek: smallint(),
});

type TargetCols = { targetType: AnyPgColumn; perDay: AnyPgColumn; daysPerWeek: AnyPgColumn; timesPerWeek: AnyPgColumn };

const targetChecks = (name: string, t: TargetCols) => [
  check(
    `${name}_target_type`,
    sql`${t.targetType} IN ('days_per_week','times_per_week','times_per_day','times_per_day_on_days')`,
  ),
  check(`${name}_per_day`, sql`${t.perDay} BETWEEN 1 AND 20`),
  check(`${name}_days_per_week`, sql`${t.daysPerWeek} BETWEEN 1 AND 7`),
  check(`${name}_times_per_week`, sql`${t.timesPerWeek} BETWEEN 1 AND 100`),
  // Each type has exactly its own fields.
  check(
    `${name}_target_fields`,
    sql`(${t.targetType} IS NULL AND ${t.perDay} IS NULL AND ${t.daysPerWeek} IS NULL AND ${t.timesPerWeek} IS NULL)
     OR (${t.targetType} = 'days_per_week' AND ${t.daysPerWeek} IS NOT NULL AND ${t.perDay} IS NULL AND ${t.timesPerWeek} IS NULL)
     OR (${t.targetType} = 'times_per_week' AND ${t.timesPerWeek} IS NOT NULL AND ${t.perDay} IS NULL AND ${t.daysPerWeek} IS NULL)
     OR (${t.targetType} = 'times_per_day' AND ${t.perDay} IS NOT NULL AND ${t.daysPerWeek} IS NULL AND ${t.timesPerWeek} IS NULL)
     OR (${t.targetType} = 'times_per_day_on_days' AND ${t.perDay} IS NOT NULL AND ${t.daysPerWeek} IS NOT NULL AND ${t.timesPerWeek} IS NULL)`,
  ),
];

// ---- days and weeks ----

export const dayEntries = pgTable(
  'day_entries',
  {
    id: uuid().primaryKey(), // v5(planner_id, date)
    date: date({ mode: 'string' }).notNull(),
    focus: varchar({ length: TEXT_LIMITS.focus }),
    note: varchar({ length: TEXT_LIMITS.note }),
    ...syncColumns(),
  },
  (t) => [unique().on(t.plannerId, t.date), feedIndex('day_entries', t)],
);

export const weekNotes = pgTable(
  'week_notes',
  {
    id: uuid().primaryKey(), // v5(planner_id, week_key)
    weekKey: date({ mode: 'string' }).notNull(),
    body: varchar({ length: TEXT_LIMITS.note }),
    ...syncColumns(),
  },
  (t) => [
    unique().on(t.plannerId, t.weekKey),
    check('week_notes_week_key_monday', isMonday(t.weekKey)),
    feedIndex('week_notes', t),
  ],
);

// ---- tasks and to-dos ----

export const tasks = pgTable(
  'tasks',
  {
    id: uuid().primaryKey(),
    date: date({ mode: 'string' }).notNull(),
    title: varchar({ length: TEXT_LIMITS.title }).notNull(),
    done: boolean().notNull().default(false), // only used without a target (J5)
    position: positionText().notNull(),
    perDay: smallint(), // N times a day; null = once
    spanDays: smallint(), // spread over consecutive days (J4); null = that day only
    ...syncColumns(),
  },
  (t) => [
    check('tasks_per_day', sql`${t.perDay} BETWEEN 1 AND 20`),
    check('tasks_span_days', sql`${t.spanDays} BETWEEN 2 AND 31`),
    feedIndex('tasks', t),
  ],
);

export const weeklyTodos = pgTable(
  'weekly_todos',
  {
    id: uuid().primaryKey(),
    weekKey: date({ mode: 'string' }).notNull(),
    title: varchar({ length: TEXT_LIMITS.title }).notNull(),
    done: boolean().notNull().default(false), // only used without a target (J5)
    position: positionText().notNull(),
    ...targetColumns(),
    ...syncColumns(),
  },
  (t) => [
    check('weekly_todos_week_key_monday', isMonday(t.weekKey)),
    ...targetChecks('weekly_todos', t),
    feedIndex('weekly_todos', t),
  ],
);

// ---- habits ----

export const habits = pgTable(
  'habits',
  {
    id: uuid().primaryKey(),
    name: varchar({ length: TEXT_LIMITS.habitName }).notNull(),
    position: positionText().notNull(),
    startsOn: date({ mode: 'string' }).notNull(),
    endsOn: date({ mode: 'string' }),
    hideWhenAchieved: boolean().notNull().default(false), // J16: default keep showing
    ...syncColumns(),
  },
  (t) => [
    check('habits_starts_on_monday', isMonday(t.startsOn)),
    check('habits_ends_on_monday', sql`${t.endsOn} IS NULL OR ${isMonday(t.endsOn)}`),
    feedIndex('habits', t),
  ],
);

export const habitSchedules = pgTable(
  'habit_schedules',
  {
    id: uuid().primaryKey(), // v5(habit_id, effective_from)
    habitId: uuid()
      .notNull()
      .references(() => habits.id, { onDelete: 'cascade' }),
    effectiveFrom: date({ mode: 'string' }).notNull(),
    weekdays: smallint().notNull(),
    ...targetColumns(),
    ...syncColumns(),
  },
  (t) => [
    unique().on(t.habitId, t.effectiveFrom),
    check('habit_schedules_effective_from_monday', isMonday(t.effectiveFrom)),
    check('habit_schedules_weekdays', sql`${t.weekdays} BETWEEN 1 AND 127`),
    ...targetChecks('habit_schedules', t),
    // "3 days a week" can't exceed the selected days.
    check(
      'habit_schedules_days_within_selection',
      sql`${t.daysPerWeek} IS NULL OR ${t.daysPerWeek} <= bit_count((${t.weekdays})::int::bit(7))`,
    ),
    index('habit_schedules_habit').on(t.habitId),
    feedIndex('habit_schedules', t),
  ],
);

/**
 * One completion = one tap on a habit, weekly to-do or task for a date (J7). Append-only, so
 * concurrent offline taps from several devices all survive sync; undo tombstones the latest.
 * `item_id` is polymorphic (by `item_type`), so it has no foreign key.
 */
export const completions = pgTable(
  'completions',
  {
    id: uuid().primaryKey(),
    itemType: text().notNull(),
    itemId: uuid().notNull(),
    date: date({ mode: 'string' }).notNull(),
    ...syncColumns(),
  },
  (t) => [
    check('completions_item_type', sql`${t.itemType} IN ('habit','weekly_todo','task')`),
    index('completions_item_date').on(t.itemId, t.date),
    feedIndex('completions', t),
  ],
);

// ---- events ----

export const events = pgTable(
  'events',
  {
    id: uuid().primaryKey(),
    title: varchar({ length: TEXT_LIMITS.title }).notNull(),
    startDate: date({ mode: 'string' }).notNull(),
    allDay: boolean().notNull().default(false),
    startTime: time(),
    endTime: time(),
    recurrenceFreq: text(),
    recurrenceWeekdays: smallint(),
    recurrenceUntil: date({ mode: 'string' }),
    recurrenceCount: integer(),
    ...syncColumns(),
  },
  (t) => [
    check(
      'events_recurrence_freq',
      sql`${t.recurrenceFreq} IN ('daily','weekdays','weekly','monthly','yearly')`,
    ),
    check('events_recurrence_weekdays', sql`${t.recurrenceWeekdays} BETWEEN 1 AND 127`),
    check('events_recurrence_count', sql`${t.recurrenceCount} > 0`),
    check('events_all_day_times', sql`${t.allDay} = (${t.startTime} IS NULL)`),
    check('events_all_day_no_end', sql`NOT ${t.allDay} OR ${t.endTime} IS NULL`),
    check('events_end_after_start', sql`${t.endTime} IS NULL OR ${t.endTime} > ${t.startTime}`),
    check(
      'events_weekly_weekdays',
      sql`(${t.recurrenceFreq} = 'weekly' AND ${t.recurrenceWeekdays} IS NOT NULL) OR (${t.recurrenceFreq} IS DISTINCT FROM 'weekly' AND ${t.recurrenceWeekdays} IS NULL)`,
    ),
    check('events_until_or_count', sql`${t.recurrenceUntil} IS NULL OR ${t.recurrenceCount} IS NULL`),
    check(
      'events_end_needs_recurrence',
      sql`${t.recurrenceFreq} IS NOT NULL OR (${t.recurrenceUntil} IS NULL AND ${t.recurrenceCount} IS NULL)`,
    ),
    feedIndex('events', t),
  ],
);

export const eventExceptions = pgTable(
  'event_exceptions',
  {
    id: uuid().primaryKey(), // v5(event_id, original_date)
    eventId: uuid()
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    originalDate: date({ mode: 'string' }).notNull(),
    cancelled: boolean().notNull().default(false),
    // Full snapshot of the occurrence (not partial overrides).
    title: varchar({ length: TEXT_LIMITS.title }),
    date: date({ mode: 'string' }),
    allDay: boolean(),
    startTime: time(),
    endTime: time(),
    ...syncColumns(),
  },
  (t) => [
    unique().on(t.eventId, t.originalDate),
    check(
      'event_exceptions_snapshot',
      sql`${t.cancelled} OR (${t.title} IS NOT NULL AND ${t.date} IS NOT NULL AND ${t.allDay} IS NOT NULL)`,
    ),
    index('event_exceptions_event').on(t.eventId),
    feedIndex('event_exceptions', t),
  ],
);

export const eventReminders = pgTable(
  'event_reminders',
  {
    id: uuid().primaryKey(),
    eventId: uuid()
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }), // reminders are personal (Q5)
    offsetMinutes: integer().notNull(), // before start; all-day: before 09:00 (Q6)
    ...syncColumns(),
  },
  (t) => [
    check('event_reminders_offset', sql`${t.offsetMinutes} >= 0`),
    index('event_reminders_event').on(t.eventId),
    feedIndex('event_reminders', t),
  ],
);
