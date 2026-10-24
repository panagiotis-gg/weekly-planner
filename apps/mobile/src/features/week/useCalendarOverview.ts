import {
  addDays,
  checklistProgress,
  countCompletions,
  daysInMonth,
  habitProgress,
  HabitWeekRow,
  IsoDate,
  makeDate,
  monthsSpanned,
  taskOccursOn,
  WeekRange,
} from '@planner/shared';
import { useLiveQuery } from '@/data/changes';
import { getTasksInRange } from '@/data/repositories/checklists';
import { getCompletions } from '@/data/repositories/completions';
import { getOccurrences } from '@/data/repositories/events';
import { taskView } from '@/features/checklist/itemViews';
import i18n from '@/i18n';
import { formatTime } from '@/lib/format';

/** What the calendar shows for one date (levels 1 and 3 of the overview). */
export interface DayOverview {
  /** Task progress %, or null when the day has no tasks (no ring). */
  taskPercent: number | null;
  tasksDone: number;
  tasksTotal: number;
  hasEvents: boolean;
  /** First event of the day: "All day" or its start time. */
  firstEvent: string | null;
  /** Selected week only: habits due that day and how many met their daily goal. */
  habitsDue: number;
  habitsDone: number;
}

export interface CalendarOverview {
  days: ReadonlyMap<IsoDate, DayOverview>;
  /** One-line summary of the selected week (level 2). */
  weekSummary: string;
}

/**
 * Per-day overview for every date in the visible month(s), plus the selected week's summary.
 * Task progress counts partial credit for tasks with targets (J5), the same as each day's list.
 */
export function useCalendarOverview(plannerId: string, range: WeekRange, habitRows: readonly HabitWeekRow[]): CalendarOverview {
  return useLiveQuery(() => {
    const months = monthsSpanned(range);
    const first = months[0]!;
    const last = months.at(-1)!;
    const from = makeDate(first.year, first.month, 1);
    const to = makeDate(last.year, last.month, daysInMonth(last.year, last.month));

    const tasks = getTasksInRange(plannerId, from, to);
    const counts = countCompletions(getCompletions(plannerId, from, to));
    const occurrences = getOccurrences(plannerId, from, to); // sorted: all-day first, then by time
    const weekDays = new Set(range.days);

    const days = new Map<IsoDate, DayOverview>();
    for (let date = from; date <= to; date = addDays(date, 1)) {
      const views = tasks.filter((t) => taskOccursOn(t, date)).map((t) => taskView(t, date, counts, counts));
      const progress = checklistProgress(views.map((v) => ({ done: v.struck, fraction: v.fraction })));
      const firstOccurrence = occurrences.find((o) => o.date === date);
      const habitCells = weekDays.has(date)
        ? habitRows.map((r) => r.days.find((d) => d.date === date)).filter((d) => d?.scheduled)
        : [];
      days.set(date, {
        taskPercent: progress.percent,
        tasksDone: progress.done,
        tasksTotal: progress.total,
        hasEvents: firstOccurrence !== undefined,
        firstEvent: firstOccurrence
          ? firstOccurrence.allDay
            ? i18n.t('day.allDay')
            : formatTime(firstOccurrence.startTime!)
          : null,
        habitsDue: habitCells.length,
        habitsDone: habitCells.filter((d) => d?.met).length,
      });
    }

    let done = 0;
    let total = 0;
    for (const date of range.days) {
      done += days.get(date)?.tasksDone ?? 0;
      total += days.get(date)?.tasksTotal ?? 0;
    }
    const events = occurrences.filter((o) => weekDays.has(o.date)).length;
    const habits = habitProgress(habitRows).percent;
    const parts = [
      total > 0 ? i18n.t('calendar.summaryTasks', { done, total }) : null,
      events > 0 ? i18n.t('calendar.summaryEvents', { count: events }) : null,
      habits !== null ? i18n.t('calendar.summaryHabits', { percent: habits }) : null,
    ].filter(Boolean);
    const weekSummary = parts.length
      ? `${i18n.t('calendar.thisWeek')} · ${parts.join(' · ')}`
      : i18n.t('calendar.nothingPlanned');

    return { days, weekSummary };
  });
}
