import { IsoDate, isoWeekday, maskIncludes } from './dates';
import { percent } from './percent';
import { evaluateTarget, NO_TARGET, Target, TargetEvaluation, TargetType } from './targets';
import { WeekRange } from './week';

export { percent } from './percent';

export interface Progress {
  /** Items fully done. */
  done: number;
  total: number;
  /** Whole-number percentage (DECISIONS §A "Progress % display"), or null when there is nothing to count. */
  percent: number | null;
}

export interface ChecklistItemLike {
  done: boolean;
  deleted?: boolean;
  /**
   * Partial credit 0..1 for items with a target (J5: min(count, target) ÷ target).
   * When absent, the item counts 1 if done, else 0.
   */
  fraction?: number;
}

/** Daily tasks and weekly to-dos: Σ credit ÷ items. Without targets this is checked ÷ total. */
export function checklistProgress(items: readonly ChecklistItemLike[]): Progress {
  const live = items.filter((i) => !i.deleted);
  const credit = live.reduce((sum, i) => sum + (i.fraction ?? (i.done ? 1 : 0)), 0);
  return { done: live.filter((i) => i.done).length, total: live.length, percent: percent(credit, live.length) };
}

// ---- Habits ----

export interface HabitLike {
  id: string;
  /** Week key of the first week the habit appears in. */
  startsOn: IsoDate;
  /** Week key of the last week it appears in ("stop tracking"), or null. */
  endsOn: IsoDate | null;
  deleted?: boolean;
}

/** One version of a habit's day selection and target, effective from a week (J13). */
export interface HabitScheduleLike {
  habitId: string;
  effectiveFrom: IsoDate;
  weekdays: number;
  targetType?: TargetType | null;
  perDay?: number | null;
  daysPerWeek?: number | null;
  timesPerWeek?: number | null;
  deleted?: boolean;
}

/** A completion record (J7): one per tap; a day's count is the number of live records. */
export interface CompletionLike {
  itemId: string;
  date: IsoDate;
  deleted?: boolean;
}

export function isHabitActiveInWeek(habit: HabitLike, weekKey: IsoDate): boolean {
  if (habit.deleted) return false;
  return habit.startsOn <= weekKey && (habit.endsOn === null || habit.endsOn >= weekKey);
}

/** The schedule version that applies to a week: the latest one effective on or before it. */
export function scheduleVersionForWeek(
  habitId: string,
  schedules: readonly HabitScheduleLike[],
  weekKey: IsoDate,
): HabitScheduleLike | null {
  let best: HabitScheduleLike | null = null;
  for (const s of schedules) {
    if (s.deleted || s.habitId !== habitId || s.effectiveFrom > weekKey) continue;
    if (best === null || s.effectiveFrom > best.effectiveFrom) best = s;
  }
  return best;
}

/** The day selection that applies to a week. */
export function scheduleForWeek(habitId: string, schedules: readonly HabitScheduleLike[], weekKey: IsoDate): number | null {
  return scheduleVersionForWeek(habitId, schedules, weekKey)?.weekdays ?? null;
}

export function targetOf(version: HabitScheduleLike | null): Target {
  if (!version) return NO_TARGET;
  return {
    targetType: version.targetType ?? null,
    perDay: version.perDay ?? null,
    daysPerWeek: version.daysPerWeek ?? null,
    timesPerWeek: version.timesPerWeek ?? null,
  };
}

/** Count live completions per item and date. */
export function countCompletions(completions: readonly CompletionLike[]): Map<string, Map<IsoDate, number>> {
  const byItem = new Map<string, Map<IsoDate, number>>();
  for (const c of completions) {
    if (c.deleted) continue;
    const byDate = byItem.get(c.itemId) ?? new Map<IsoDate, number>();
    byDate.set(c.date, (byDate.get(c.date) ?? 0) + 1);
    byItem.set(c.itemId, byDate);
  }
  return byItem;
}

export interface HabitDayCell {
  date: IsoDate;
  /** Whether this day can count (a selected day). */
  scheduled: boolean;
  count: number;
  /** Count reached the day's own goal (once, or perDay for C/D). */
  met: boolean;
}

export interface HabitWeekRow {
  habitId: string;
  target: Target;
  days: HabitDayCell[];
  evaluation: TargetEvaluation;
}

/** Habit grid for a week: only habits active that week; only selected days count (J2). */
export function habitWeekGrid(
  habits: readonly HabitLike[],
  schedules: readonly HabitScheduleLike[],
  completions: readonly CompletionLike[],
  range: WeekRange,
): HabitWeekRow[] {
  const counts = countCompletions(completions);
  return habits
    .filter((h) => isHabitActiveInWeek(h, range.weekKey))
    .map((h) => {
      const version = scheduleVersionForWeek(h.id, schedules, range.weekKey);
      const mask = version?.weekdays ?? 0;
      const target = targetOf(version);
      const habitCounts = counts.get(h.id) ?? new Map<IsoDate, number>();
      const countable = range.days.filter((date) => maskIncludes(mask, isoWeekday(date)));
      const evaluation = evaluateTarget(target, countable, habitCounts);
      const metByDate = new Map(evaluation.days.map((d) => [d.date, d.met]));
      return {
        habitId: h.id,
        target,
        evaluation,
        days: range.days.map((date) => ({
          date,
          scheduled: metByDate.has(date),
          count: habitCounts.get(date) ?? 0,
          met: metByDate.get(date) ?? false,
        })),
      };
    });
}

/** Overall weekly habits % = average of the habits' own % (J10); each habit weighs the same. */
export function habitProgress(rows: readonly HabitWeekRow[]): Progress {
  const scored = rows.filter((r) => r.evaluation.percent !== null);
  const sum = scored.reduce((acc, r) => acc + (r.evaluation.percent ?? 0), 0);
  return {
    done: rows.filter((r) => r.evaluation.achieved === true).length,
    total: rows.length,
    percent: scored.length === 0 ? null : Math.round(sum / scored.length),
  };
}
