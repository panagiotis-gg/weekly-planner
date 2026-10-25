import {
  ALL_DAYS_MASK,
  Habit,
  HabitSchedule,
  habitScheduleId,
  IsoDate,
  keyBetween,
  newId,
  NO_TARGET,
  scheduleVersionForWeek,
  shiftWeek,
  Target,
  targetOf,
} from '@planner/shared';
import { selectRows, writeFields } from '../write';

/**
 * Habits persist across weeks; the day selection and target are versioned by week, so edits
 * apply from the week being edited onwards and past weeks keep theirs (DECISIONS A3, Q9, Q15, J13).
 * `weekKey` arguments are the week the user is acting in.
 */

export function getHabits(plannerId: string): Habit[] {
  return selectRows<Habit>('habit', plannerId, '', [], 'position COLLATE BINARY ASC');
}

export function getHabitSchedules(plannerId: string): HabitSchedule[] {
  return selectRows<HabitSchedule>('habit_schedule', plannerId);
}

export function addHabit(
  plannerId: string,
  weekKey: IsoDate,
  name: string,
  weekdays = ALL_DAYS_MASK,
  target: Target = NO_TARGET,
  hideWhenAchieved = false, // J16 default: keep showing
  time: string | null = null,
): string {
  const habits = getHabits(plannerId);
  const id = newId();
  writeFields('habit', id, plannerId, {
    name: name.trim(),
    position: keyBetween(habits.at(-1)?.position ?? null, null),
    startsOn: weekKey,
    endsOn: null,
    hideWhenAchieved,
    time,
    deleted: false,
  });
  setHabitPlan(plannerId, id, weekKey, weekdays, target);
  return id;
}

/** Optional time on each scheduled day (K4). */
export function setHabitTime(habit: Habit, time: string | null): void {
  if (habit.time !== time) writeFields('habit', habit.id, habit.plannerId, { time });
}

export function renameHabit(habit: Habit, name: string): void {
  writeFields('habit', habit.id, habit.plannerId, { name: name.trim() });
}

export function setHideWhenAchieved(habit: Habit, hideWhenAchieved: boolean): void {
  writeFields('habit', habit.id, habit.plannerId, { hideWhenAchieved });
}

/** Days + target effective from `weekKey` onwards (one version per habit and week, deterministic id). */
export function setHabitPlan(plannerId: string, habitId: string, weekKey: IsoDate, weekdays: number, target: Target): void {
  const current = scheduleVersionForWeek(habitId, getHabitSchedules(plannerId), weekKey);
  const currentTarget = targetOf(current);
  const unchanged =
    current?.weekdays === weekdays &&
    (Object.keys(target) as (keyof Target)[]).every((k) => currentTarget[k] === target[k]);
  if (unchanged) return;
  writeFields('habit_schedule', habitScheduleId(habitId, weekKey), plannerId, {
    habitId,
    effectiveFrom: weekKey,
    weekdays,
    ...target,
    deleted: false,
  });
}

/** "Stop tracking": gone from `weekKey` on, earlier weeks keep it. */
export function stopTrackingHabit(habit: Habit, weekKey: IsoDate): void {
  const endsOn = shiftWeek(weekKey, -1);
  if (endsOn < habit.startsOn) {
    deleteHabit(habit); // it would appear in no week at all
    return;
  }
  writeFields('habit', habit.id, habit.plannerId, { endsOn });
}

/** "Delete": removed from every week. */
export function deleteHabit(habit: Habit): void {
  writeFields('habit', habit.id, habit.plannerId, { deleted: true });
}
