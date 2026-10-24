import { countCompletions, habitWeekGrid, IsoDate, weekKeyOf, weekRange } from '@planner/shared';
import { useLiveQuery } from './changes';
import { getTasks, getTasksInRange, getWeeklyTodos } from './repositories/checklists';
import { getCompletions, getItemCompletions } from './repositories/completions';
import { getDayEntry, getWeekNote } from './repositories/days';
import { getOccurrences } from './repositories/events';
import { getHabits, getHabitSchedules } from './repositories/habits';
import { getPlanner } from './repositories/planners';

/** Everything the Week screen shows, computed with the shared domain functions. */
export function useWeekData(plannerId: string, weekKey: IsoDate) {
  return useLiveQuery(() => {
    const planner = getPlanner(plannerId);
    const range = weekRange(weekKey, planner.weekStartDay);
    const habits = getHabits(plannerId);
    const schedules = getHabitSchedules(plannerId);
    const completions = getCompletions(plannerId, range.start, range.end);
    return {
      planner,
      range,
      habits,
      schedules,
      habitRows: habitWeekGrid(habits, schedules, completions, range),
      todos: getWeeklyTodos(plannerId, weekKey),
      weekNote: getWeekNote(plannerId, weekKey),
      tasks: getTasksInRange(plannerId, range.start, range.end),
      /** itemId → date → completion count, for this week. */
      counts: countCompletions(completions),
    };
  });
}

/**
 * Everything a day column shows: focus, note, tasks in order (spread tasks included),
 * events with recurrence expanded, and "Today's habits" (J15) for that date.
 */
export function useDayData(plannerId: string, date: IsoDate) {
  return useLiveQuery(() => {
    const planner = getPlanner(plannerId);
    const range = weekRange(weekKeyOf(date, planner.weekStartDay), planner.weekStartDay);
    const habits = getHabits(plannerId);
    const completions = getCompletions(plannerId, range.start, range.end);
    const rows = habitWeekGrid(habits, getHabitSchedules(plannerId), completions, range);
    const byId = new Map(habits.map((h) => [h.id, h]));
    const todaysHabits = rows
      .filter((row) => row.days.find((d) => d.date === date)?.scheduled)
      // J16: per habit, optionally hide once the week's target is met.
      .filter((row) => !(row.evaluation.achieved && byId.get(row.habitId)?.hideWhenAchieved))
      .map((row) => ({ habit: byId.get(row.habitId)!, row }));
    const tasks = getTasks(plannerId, date);
    // A spread task's span can cross into another week, so count its whole span (J4).
    const spanCounts = new Map(
      tasks
        .filter((t) => t.spanDays !== null)
        .map((t) => [t.id, countCompletions(getItemCompletions(plannerId, t.id)).get(t.id) ?? new Map<IsoDate, number>()]),
    );
    return {
      entry: getDayEntry(plannerId, date),
      tasks,
      occurrences: getOccurrences(plannerId, date, date),
      todaysHabits,
      counts: countCompletions(completions),
      spanCounts,
    };
  });
}
