import { z } from 'zod';
import { addDays, weekdaysFromMask } from '../dates';
import { TEXT_LIMITS } from '../limits';
import { RECURRENCE_FREQS } from '../recurrence';
import { TARGET_LIMITS, TARGET_TYPES, targetIssues } from '../targets';
import {
  hexColorSchema,
  isoDateSchema,
  positionSchema,
  requiredText,
  singleLineText,
  uuidSchema,
  wallTimeSchema,
  weekdayMaskSchema,
  weekKeySchema,
  weekStartDaySchema,
} from './primitives';

/**
 * Synced entities (database-schema.md §4), camelCase.
 *
 * `*Fields` schemas list the fields a sync mutation may write: every column except `id` and
 * `plannerId`, which identify the row and never change. They have no cross-field checks,
 * so they can be used per field. `*Row` schemas describe a complete row and add the
 * cross-field invariants, which are checked on the merged row (architecture §5.2).
 */

const deleted = z.boolean();
const nullableNote = z.string().max(TEXT_LIMITS.note).nullable();

// ---- planner settings (owner only; name/kind rules enforced by the server) ----
/** ISO weekday ("1" = Monday … "7" = Sunday) → colour; missing days use theme defaults. */
export const dayColorsSchema = z.partialRecord(z.enum(['1', '2', '3', '4', '5', '6', '7']), hexColorSchema);

export const plannerFields = z.strictObject({
  name: requiredText(TEXT_LIMITS.plannerName).nullable(),
  weekStartDay: weekStartDaySchema,
  dayColors: dayColorsSchema,
});

// ---- days and weeks ----
export const dayEntryFields = z.strictObject({
  date: isoDateSchema,
  focus: singleLineText(TEXT_LIMITS.focus).nullable(),
  note: nullableNote,
  deleted,
});

export const weekNoteFields = z.strictObject({
  weekKey: weekKeySchema,
  body: nullableNote,
  deleted,
});

// ---- targets (J1–J13) ----
const limited = (l: { min: number; max: number }) => z.number().int().min(l.min).max(l.max).nullable();
const targetFieldShape = {
  targetType: z.enum(TARGET_TYPES).nullable(),
  perDay: limited(TARGET_LIMITS.perDay),
  daysPerWeek: limited(TARGET_LIMITS.daysPerWeek),
  timesPerWeek: limited(TARGET_LIMITS.timesPerWeek),
};

// ---- tasks and to-dos ----
export const taskFields = z.strictObject({
  date: isoDateSchema,
  title: requiredText(TEXT_LIMITS.title),
  /** Used only when the task has no target (perDay null); with a target, "done" is derived from counts (J5). */
  done: z.boolean(),
  position: positionSchema,
  /** N times a day; null = once (checkbox). */
  perDay: limited(TARGET_LIMITS.perDay),
  /** Spread over this many consecutive days from `date`; null = that day only (J4). */
  spanDays: limited(TARGET_LIMITS.spanDays),
  /** Optional time of day; reminders count from it, or from 09:00 without one (K4). */
  time: wallTimeSchema.nullable(),
  deleted,
});

export const weeklyTodoFields = z.strictObject({
  weekKey: weekKeySchema,
  title: requiredText(TEXT_LIMITS.title),
  /** Used only when the to-do has no target; with a target, "done" is derived from counts (J5). */
  done: z.boolean(),
  position: positionSchema,
  ...targetFieldShape,
  /** Optional due day within the to-do's week, and optional time on it; reminders need a due day (K5). */
  dueDate: isoDateSchema.nullable(),
  dueTime: wallTimeSchema.nullable(),
  deleted,
});

// ---- habits ----
export const habitFields = z.strictObject({
  name: requiredText(TEXT_LIMITS.habitName),
  position: positionSchema,
  startsOn: weekKeySchema,
  endsOn: weekKeySchema.nullable(),
  /** Hide from "Today's habits" once the week's target is met (J16; default false = keep showing). */
  hideWhenAchieved: z.boolean(),
  /** Optional time of day on each scheduled day; reminders count from it, or from 09:00 (K4). */
  time: wallTimeSchema.nullable(),
  deleted,
});

/** Day selection + target, versioned by week (J13). */
export const habitScheduleFields = z.strictObject({
  habitId: uuidSchema,
  effectiveFrom: weekKeySchema,
  weekdays: weekdayMaskSchema,
  ...targetFieldShape,
  deleted,
});

/** One completion = one tap on a habit, weekly to-do or task for a date (J7). */
export const COMPLETION_ITEM_TYPES = ['habit', 'weekly_todo', 'task'] as const;
export const completionFields = z.strictObject({
  itemType: z.enum(COMPLETION_ITEM_TYPES),
  itemId: uuidSchema,
  date: isoDateSchema,
  deleted,
});

// ---- events ----
export const eventFields = z.strictObject({
  title: requiredText(TEXT_LIMITS.title),
  startDate: isoDateSchema,
  allDay: z.boolean(),
  startTime: wallTimeSchema.nullable(),
  endTime: wallTimeSchema.nullable(),
  recurrenceFreq: z.enum(RECURRENCE_FREQS).nullable(),
  recurrenceWeekdays: weekdayMaskSchema.nullable(),
  recurrenceUntil: isoDateSchema.nullable(),
  recurrenceCount: z.number().int().positive().nullable(),
  deleted,
});

export const eventExceptionFields = z.strictObject({
  eventId: uuidSchema,
  originalDate: isoDateSchema,
  cancelled: z.boolean(),
  title: requiredText(TEXT_LIMITS.title).nullable(),
  date: isoDateSchema.nullable(),
  allDay: z.boolean().nullable(),
  startTime: wallTimeSchema.nullable(),
  endTime: wallTimeSchema.nullable(),
  deleted,
});

// ---- reminders (K1–K10) ----
/** Items that can have reminders (K1). */
export const REMINDER_ITEM_TYPES = ['event', 'task', 'habit', 'weekly_todo'] as const;
export const reminderFields = z.strictObject({
  itemType: z.enum(REMINDER_ITEM_TYPES),
  itemId: uuidSchema,
  /** Reminders are personal (Q5). */
  userId: uuidSchema,
  /** Minutes before the item's time, or before 09:00 when it has none (Q6, K4, K5). */
  offsetMinutes: z.number().int().min(0),
  deleted,
});

// ---- cross-field invariants ----

type TimeSlot = { allDay: boolean | null; startTime: string | null; endTime: string | null };

/** All-day ⇔ no times; timed ⇒ start time; end (optional) later than start on the same day (Q8). */
export function timeSlotIssues(slot: TimeSlot): string[] {
  const issues: string[] = [];
  if (slot.allDay) {
    if (slot.startTime !== null || slot.endTime !== null) issues.push('ALL_DAY_HAS_TIMES');
  } else {
    if (slot.startTime === null) issues.push('START_TIME_REQUIRED');
    if (slot.startTime !== null && slot.endTime !== null && slot.endTime <= slot.startTime) {
      issues.push('END_NOT_AFTER_START');
    }
  }
  return issues;
}

export type EventFields = z.infer<typeof eventFields>;
export type EventExceptionFields = z.infer<typeof eventExceptionFields>;

export function eventIssues(e: EventFields): string[] {
  const issues = timeSlotIssues(e);
  if ((e.recurrenceFreq === 'weekly') !== (e.recurrenceWeekdays !== null)) {
    issues.push('WEEKLY_REQUIRES_WEEKDAYS');
  }
  if (e.recurrenceUntil !== null && e.recurrenceCount !== null) issues.push('UNTIL_AND_COUNT');
  if (e.recurrenceFreq === null && (e.recurrenceUntil !== null || e.recurrenceCount !== null)) {
    issues.push('END_WITHOUT_RECURRENCE');
  }
  if (e.recurrenceUntil !== null && e.recurrenceUntil < e.startDate) issues.push('UNTIL_BEFORE_START');
  return issues;
}

export type HabitScheduleFields = z.infer<typeof habitScheduleFields>;
export type WeeklyTodoFields = z.infer<typeof weeklyTodoFields>;

/** A habit target can't ask for more days than the selected days (J2, J12). */
export function habitScheduleIssues(s: HabitScheduleFields): string[] {
  return targetIssues(s, weekdaysFromMask(s.weekdays).length);
}

/** All 7 days of a weekly to-do's week count (J3); a due day lies in that week and comes before a due time (K5). */
export function weeklyTodoIssues(t: WeeklyTodoFields): string[] {
  const issues = targetIssues(t, 7);
  if (t.dueTime !== null && t.dueDate === null) issues.push('DUE_TIME_WITHOUT_DATE');
  if (t.dueDate !== null && (t.dueDate < t.weekKey || t.dueDate > addDays(t.weekKey, 6))) {
    issues.push('DUE_DATE_OUTSIDE_WEEK');
  }
  return issues;
}

export function eventExceptionIssues(x: EventExceptionFields): string[] {
  if (x.cancelled) return [];
  const issues: string[] = [];
  if (x.title === null || x.date === null || x.allDay === null) issues.push('SNAPSHOT_INCOMPLETE');
  return [...issues, ...timeSlotIssues(x)];
}

function withIssues<T extends z.ZodType>(schema: T, check: (v: z.infer<T>) => string[]) {
  return schema.superRefine((value, ctx) => {
    for (const code of check(value)) ctx.addIssue({ code: 'custom', message: code });
  });
}

const rowKeys = { id: uuidSchema, plannerId: uuidSchema };

export const dayEntryRow = dayEntryFields.extend(rowKeys);
export const weekNoteRow = weekNoteFields.extend(rowKeys);
export const taskRow = taskFields.extend(rowKeys);
export const weeklyTodoRow = withIssues(weeklyTodoFields.extend(rowKeys), weeklyTodoIssues);
export const habitRow = habitFields
  .extend(rowKeys)
  .refine((h) => h.endsOn === null || h.endsOn >= h.startsOn, 'ENDS_BEFORE_STARTS');
export const habitScheduleRow = withIssues(habitScheduleFields.extend(rowKeys), habitScheduleIssues);
export const completionRow = completionFields.extend(rowKeys);
export const eventRow = withIssues(eventFields.extend(rowKeys), eventIssues);
export const eventExceptionRow = withIssues(eventExceptionFields.extend(rowKeys), eventExceptionIssues);
export const reminderRow = reminderFields.extend(rowKeys);
export const plannerSettingsRow = plannerFields.extend({ id: uuidSchema });

export type DayEntry = z.infer<typeof dayEntryRow>;
export type WeekNote = z.infer<typeof weekNoteRow>;
export type Task = z.infer<typeof taskRow>;
export type WeeklyTodo = z.infer<typeof weeklyTodoRow>;
export type Habit = z.infer<typeof habitRow>;
export type HabitSchedule = z.infer<typeof habitScheduleRow>;
export type Completion = z.infer<typeof completionRow>;
export type PlannerEvent = z.infer<typeof eventRow>;
export type EventException = z.infer<typeof eventExceptionRow>;
export type Reminder = z.infer<typeof reminderRow>;
export type ReminderItemType = (typeof REMINDER_ITEM_TYPES)[number];
export type PlannerSettings = z.infer<typeof plannerSettingsRow>;
