import { addDays, diffDays, IsoDate } from './dates';
import { percent } from './percent';

/**
 * Optional targets: "how many days / times" an activity must be done for it to count as
 * achieved (DECISIONS J1–J16).
 *
 *   days_per_week          A: done on at least `daysPerWeek` different days
 *   times_per_week         B: done `timesPerWeek` times in total, any spread
 *   times_per_day          C: done `perDay` times on every countable day
 *   times_per_day_on_days  D: done `perDay` times on at least `daysPerWeek` days
 *
 * Counts come from completion records (one per tap, J7). "Countable days" are the days that
 * can count: a habit's selected days that week, or all 7 days of a weekly to-do's week.
 */

export const TARGET_TYPES = ['days_per_week', 'times_per_week', 'times_per_day', 'times_per_day_on_days'] as const;
export type TargetType = (typeof TARGET_TYPES)[number];

/** Limits (J12). */
export const TARGET_LIMITS = {
  perDay: { min: 1, max: 20 },
  timesPerWeek: { min: 1, max: 100 },
  daysPerWeek: { min: 1, max: 7 },
  spanDays: { min: 2, max: 31 },
} as const;

export interface Target {
  targetType: TargetType | null;
  perDay: number | null;
  daysPerWeek: number | null;
  timesPerWeek: number | null;
}

export const NO_TARGET: Target = { targetType: null, perDay: null, daysPerWeek: null, timesPerWeek: null };

/**
 * Field consistency for a target. `countableDays` (when known) caps `daysPerWeek`:
 * "3 days a week" can't be met if only 2 days count.
 */
export function targetIssues(t: Target, countableDays?: number): string[] {
  const issues: string[] = [];
  const needs = {
    perDay: t.targetType === 'times_per_day' || t.targetType === 'times_per_day_on_days',
    daysPerWeek: t.targetType === 'days_per_week' || t.targetType === 'times_per_day_on_days',
    timesPerWeek: t.targetType === 'times_per_week',
  };
  for (const field of ['perDay', 'daysPerWeek', 'timesPerWeek'] as const) {
    if (needs[field] && t[field] === null) issues.push('TARGET_FIELD_REQUIRED');
    if (!needs[field] && t[field] !== null) issues.push('TARGET_FIELD_UNEXPECTED');
  }
  if (countableDays !== undefined && t.daysPerWeek !== null && t.daysPerWeek > countableDays) {
    issues.push('TARGET_DAYS_EXCEED_COUNTABLE');
  }
  return [...new Set(issues)];
}

/** Times a single day needs before it "counts" (C/D: perDay; otherwise once). */
export function dailyGoal(t: Target): number {
  return t.targetType === 'times_per_day' || t.targetType === 'times_per_day_on_days' ? (t.perDay ?? 1) : 1;
}

/** Whether a day cell is a plain checkbox (once a day is enough and days, not times, are counted). */
export function isCheckboxTarget(t: Target): boolean {
  return dailyGoal(t) === 1 && t.targetType !== 'times_per_week';
}

export interface TargetEvaluation {
  /** Whole-number % with partial credit, capped at 100 (J9); null when nothing can count. */
  percent: number | null;
  /** True when the target is met; null for items without a target. */
  achieved: boolean | null;
  /** Per countable day: count and whether that day's own goal is met. */
  days: { date: IsoDate; count: number; met: boolean }[];
  /** What the status line shows: e.g. 2 of 3 days, or 7 of 10 times. */
  summary: { unit: 'days' | 'times'; value: number; goal: number };
}

/**
 * Evaluate a target over the countable days of one week (or any period).
 * `counts` maps date → completion count; missing dates count as 0.
 */
export function evaluateTarget(
  target: Target,
  countableDates: readonly IsoDate[],
  counts: ReadonlyMap<IsoDate, number>,
): TargetEvaluation {
  const goal = dailyGoal(target);
  const days = countableDates.map((date) => {
    const count = counts.get(date) ?? 0;
    return { date, count, met: count >= goal };
  });
  const metDays = days.filter((d) => d.met).length;
  const credit = (d: { count: number }) => Math.min(d.count, goal);

  switch (target.targetType) {
    case 'days_per_week': {
      const need = target.daysPerWeek ?? 1;
      return {
        percent: percent(Math.min(metDays, need), need),
        achieved: metDays >= need,
        days,
        summary: { unit: 'days', value: metDays, goal: need },
      };
    }
    case 'times_per_week': {
      const need = target.timesPerWeek ?? 1;
      const total = days.reduce((sum, d) => sum + d.count, 0);
      return {
        percent: percent(Math.min(total, need), need),
        achieved: total >= need,
        days,
        summary: { unit: 'times', value: total, goal: need },
      };
    }
    case 'times_per_day': {
      const required = goal * days.length;
      return {
        percent: percent(days.reduce((sum, d) => sum + credit(d), 0), required),
        achieved: days.length > 0 && metDays === days.length,
        days,
        summary: { unit: 'days', value: metDays, goal: days.length },
      };
    }
    case 'times_per_day_on_days': {
      const need = target.daysPerWeek ?? 1;
      const best = days
        .map(credit)
        .sort((a, b) => b - a)
        .slice(0, need)
        .reduce((sum, c) => sum + c, 0);
      return {
        percent: percent(best, goal * need),
        achieved: metDays >= need,
        days,
        summary: { unit: 'days', value: metDays, goal: need },
      };
    }
    default:
      // No target: as before, each countable day done at least once.
      return {
        percent: percent(metDays, days.length),
        achieved: null,
        days,
        summary: { unit: 'days', value: metDays, goal: days.length },
      };
  }
}

// ---- Day tasks: N times a day, optionally spread over consecutive days (J4) ----

export interface TaskSpanLike {
  date: IsoDate;
  /** Times per day; null = once (checkbox). */
  perDay: number | null;
  /** Number of consecutive days from `date`; null = that day only. */
  spanDays: number | null;
}

export function taskDates(task: TaskSpanLike): IsoDate[] {
  return Array.from({ length: task.spanDays ?? 1 }, (_, i) => addDays(task.date, i));
}

export function taskOccursOn(task: TaskSpanLike, date: IsoDate): boolean {
  const offset = diffDays(date, task.date);
  return offset >= 0 && offset < (task.spanDays ?? 1);
}

/** 1-based position of `date` in the span, e.g. day 2 of 5. */
export function taskSpanPosition(task: TaskSpanLike, date: IsoDate): { day: number; of: number } {
  return { day: diffDays(date, task.date) + 1, of: task.spanDays ?? 1 };
}

/** Whether a task's day entry is met: its count reaches the per-day goal. */
export function taskDayMet(task: TaskSpanLike, count: number): boolean {
  return count >= (task.perDay ?? 1);
}
