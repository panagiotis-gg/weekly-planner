import {
  addDays,
  checklistProgress,
  countCompletions,
  daysInMonth,
  IsoDate,
  makeDate,
  monthsSpanned,
  taskOccursOn,
  WeekRange,
  weekRange,
  WeekStartDay,
} from '@planner/shared';
import { useLiveQuery } from '@/data/changes';
import { getTasksInRange, getTodosDueInRange } from '@/data/repositories/checklists';
import { getCompletions } from '@/data/repositories/completions';
import { getOccurrences } from '@/data/repositories/events';
import { taskView, todoView } from '@/features/checklist/itemViews';

/** One name in a day cell of the calendar (DECISIONS A12). */
export interface CalendarItem {
  id: string;
  title: string;
  kind: 'event' | 'task' | 'todo';
  /** Start time; null for all-day events and items without a time, which come first. */
  time: string | null;
  done: boolean;
}

/** What the calendar shows for one date. */
export interface DayOverview {
  /** Task progress %, or null when the day has no tasks (no ring). */
  taskPercent: number | null;
  tasksDone: number;
  tasksTotal: number;
  /** Events, tasks and to-dos due that day: all-day and untimed first, then by time. */
  items: CalendarItem[];
}

/**
 * Per-day agenda for every date in the visible month(s).
 * Task progress counts partial credit for tasks with targets (J5), the same as each day's list.
 */
export function useCalendarOverview(
  plannerId: string,
  range: WeekRange,
  startDay: WeekStartDay,
): ReadonlyMap<IsoDate, DayOverview> {
  return useLiveQuery(() => {
    const months = monthsSpanned(range);
    const first = months[0]!;
    const last = months.at(-1)!;
    const from = makeDate(first.year, first.month, 1);
    const to = makeDate(last.year, last.month, daysInMonth(last.year, last.month));

    const tasks = getTasksInRange(plannerId, from, to);
    const todos = getTodosDueInRange(plannerId, from, to);
    // A to-do's target counts its whole week, which can reach past the visible months.
    const counts = countCompletions(getCompletions(plannerId, addDays(from, -6), addDays(to, 6)));
    const occurrences = getOccurrences(plannerId, from, to); // sorted: all-day first, then by time

    const days = new Map<IsoDate, DayOverview>();
    for (let date = from; date <= to; date = addDays(date, 1)) {
      const dayTasks = tasks.filter((t) => taskOccursOn(t, date));
      const views = dayTasks.map((t) => taskView(t, date, counts, counts));
      const progress = checklistProgress(views.map((v) => ({ done: v.struck, fraction: v.fraction })));
      const items: CalendarItem[] = [
        ...occurrences
          .filter((o) => o.date === date)
          .map((o) => ({
            id: `event:${o.eventId}:${o.originalDate}`,
            title: o.title,
            kind: 'event' as const,
            time: o.allDay ? null : o.startTime,
            done: false,
          })),
        ...dayTasks.map((t, i) => ({
          id: `task:${t.id}`,
          title: t.title,
          kind: 'task' as const,
          time: t.time,
          done: views[i]!.struck,
        })),
        ...todos
          .filter((t) => t.dueDate === date)
          .map((t) => ({
            id: `todo:${t.id}`,
            title: t.title,
            kind: 'todo' as const,
            time: t.dueTime,
            done: todoView(t, weekRange(t.weekKey, startDay), counts).struck,
          })),
      ];
      // Stable sort: within the same time, events stay ahead of tasks and to-dos.
      items.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
      days.set(date, {
        taskPercent: progress.percent,
        tasksDone: progress.done,
        tasksTotal: progress.total,
        items,
      });
    }
    return days;
  });
}
