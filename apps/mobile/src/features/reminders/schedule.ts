import {
  addDays,
  countCompletions,
  dailyGoal,
  EventException,
  evaluateTarget,
  expandEvents,
  Habit,
  IsoDate,
  isoWeekday,
  isHabitActiveInWeek,
  maskIncludes,
  PlannerEvent,
  Reminder,
  REMINDER_HORIZON_DAYS,
  reminderFireAt,
  scheduleVersionForWeek,
  targetOf,
  Task,
  taskDates,
  taskDayMet,
  WallDateTime,
  weekKeyOf,
  weekRange,
  WeeklyTodo,
} from '@planner/shared';
import { taskUsesCompletions, todoUsesCompletions } from '@/data/repositories/checklists';
import { getCompletions } from '@/data/repositories/completions';
import { getHabitSchedules } from '@/data/repositories/habits';
import { getPlanner } from '@/data/repositories/planners';
import { getMyReminders } from '@/data/repositories/reminders';
import { selectRows } from '@/data/write';
import { todoTarget } from '@/features/checklist/itemViews';
import { formatMonthDay, formatTime, formatWeekday, todayIso } from '@/lib/format';

/** One notification for the push service: when, what it says, and where tapping it goes (K6). */
export interface ScheduledNotification {
  /** Stable per reminder and day, so the push service can replace the list without duplicates. */
  id: string;
  /** Epoch milliseconds, from the wall-clock time in this device's time zone. */
  fireAt: number;
  title: string;
  body: string;
  url: string;
}

/** An item happening on a date (and time), which its reminders count back from. */
interface Happening {
  date: IsoDate;
  time: string | null;
  title: string;
  url: string;
  done: boolean;
  /** One-off items are sent however far ahead they are (K10 only limits repeating ones). */
  repeating: boolean;
}

const MAX_NOTIFICATIONS = 500;

function toEpoch(at: WallDateTime): number {
  const [date, time] = at.split('T') as [string, string];
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const [h, min] = time.split(':').map(Number) as [number, number];
  return new Date(y, m - 1, d, h, min).getTime();
}

const describe = (date: IsoDate, time: string | null) =>
  `${formatWeekday(date)} ${formatMonthDay(date)}${time ? ` · ${formatTime(time)}` : ''}`;

/**
 * The current user's upcoming reminder notifications (DECISIONS K1–K10): every occurrence of a
 * repeating event, every day of a spread task, every scheduled day of a habit. Things already
 * done are skipped (K9); repeating items only within the next 30 days (K10).
 */
export function upcomingNotifications(plannerId: string, now = new Date()): ScheduledNotification[] {
  const reminders = getMyReminders(plannerId);
  if (reminders.length === 0) return [];

  const planner = getPlanner(plannerId);
  const today = todayIso();
  const horizon = now.getTime() + REMINDER_HORIZON_DAYS * 86_400_000;
  // A reminder fires before its item, so look at items up to the longest offset past the horizon.
  const maxOffsetDays = Math.ceil(Math.max(...reminders.map((r) => r.offsetMinutes)) / 1440);
  const lastDay = addDays(today, REMINDER_HORIZON_DAYS + maxOffsetDays);
  const counts = countCompletions(getCompletions(plannerId, addDays(today, -7), lastDay));
  const countOn = (itemId: string, date: IsoDate) => counts.get(itemId)?.get(date) ?? 0;

  const byItem = new Map<string, Reminder[]>();
  for (const r of reminders) byItem.set(r.itemId, [...(byItem.get(r.itemId) ?? []), r]);
  const ids = [...byItem.keys()];
  const inIds = `id IN (${ids.map(() => '?').join(', ')})`;

  const happenings = new Map<string, Happening[]>();
  const add = (itemId: string, h: Happening) => happenings.set(itemId, [...(happenings.get(itemId) ?? []), h]);

  // Events: every occurrence (exceptions applied); all-day ones count from 09:00 (Q6).
  const exceptions = selectRows<EventException>('event_exception', plannerId);
  for (const event of selectRows<PlannerEvent>('event', plannerId, inIds, ids)) {
    const repeating = event.recurrenceFreq !== null;
    const until = repeating ? lastDay : addDays(event.startDate > today ? event.startDate : today, 366);
    for (const o of expandEvents([event], exceptions, today, until)) {
      const time = o.allDay ? null : o.startTime;
      add(event.id, { date: o.date, time, title: o.title, url: `/day/${o.date}`, done: false, repeating });
    }
  }

  // Tasks: each day of the span (J4); done when that day's goal is met (K9).
  for (const task of selectRows<Task>('task', plannerId, inIds, ids)) {
    for (const date of taskDates(task)) {
      if (date < today) continue;
      const done = taskUsesCompletions(task) ? taskDayMet(task, countOn(task.id, date)) : task.done;
      add(task.id, { date, time: task.time, title: task.title, url: `/day/${date}`, done, repeating: task.spanDays !== null });
    }
  }

  // Weekly to-dos: only with a due day (K5); done when ticked or the target is reached.
  for (const todo of selectRows<WeeklyTodo>('weekly_todo', plannerId, inIds, ids)) {
    if (todo.dueDate === null || todo.dueDate < today) continue;
    const done = todoUsesCompletions(todo)
      ? evaluateTarget(
          todoTarget(todo),
          weekRange(todo.weekKey, planner.weekStartDay).days,
          counts.get(todo.id) ?? new Map(),
        ).achieved === true
      : todo.done;
    add(todo.id, {
      date: todo.dueDate,
      time: todo.dueTime,
      title: todo.title,
      url: `/week/${todo.weekKey}`,
      done,
      repeating: false,
    });
  }

  // Habits: each scheduled day in the window; done when that day's goal is met (K9).
  const habits = selectRows<Habit>('habit', plannerId, inIds, ids);
  if (habits.length > 0) {
    const schedules = getHabitSchedules(plannerId);
    for (let date = today; date <= lastDay; date = addDays(date, 1)) {
      const weekKey = weekKeyOf(date, planner.weekStartDay);
      for (const habit of habits) {
        if (!isHabitActiveInWeek(habit, weekKey)) continue;
        const version = scheduleVersionForWeek(habit.id, schedules, weekKey);
        if (!version || !maskIncludes(version.weekdays, isoWeekday(date))) continue;
        const done = countOn(habit.id, date) >= dailyGoal(targetOf(version));
        add(habit.id, { date, time: habit.time, title: habit.name, url: `/day/${date}`, done, repeating: true });
      }
    }
  }

  const out: ScheduledNotification[] = [];
  for (const [itemId, list] of happenings) {
    for (const reminder of byItem.get(itemId) ?? []) {
      for (const h of list) {
        if (h.done) continue;
        const fireAt = toEpoch(reminderFireAt(h.date, h.time, reminder.offsetMinutes));
        if (fireAt <= now.getTime() || (h.repeating && fireAt > horizon)) continue;
        out.push({ id: `${reminder.id}:${h.date}`, fireAt, title: h.title, body: describe(h.date, h.time), url: h.url });
      }
    }
  }
  return out.sort((a, b) => a.fireAt - b.fireAt).slice(0, MAX_NOTIFICATIONS);
}
