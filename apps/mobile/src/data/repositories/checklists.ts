import { IsoDate, keyBetween, newId, Target, Task, taskDates, WeeklyTodo } from '@planner/shared';
import { selectRows, writeFields } from '../write';
import { discardCompletionsOutside } from './completions';

/**
 * Daily tasks (reorder within a day, move to another day — DECISIONS A7) and
 * weekly to-dos (no carry-over — A4). Both are position-ordered checklists.
 * Either can have a target (J1): tasks "N times a day", optionally spread over consecutive
 * days (J4); weekly to-dos the four target types (J3). Items with a target record taps as
 * completions; items without one keep using their `done` flag.
 */

const byPosition = 'position COLLATE BINARY ASC';

/** Last day of a task's span, in SQL. */
const spanEnd = "date(date, '+' || (COALESCE(span_days, 1) - 1) || ' days')";

/** Tasks shown on a day: those starting that day plus spread tasks whose span covers it. */
export function getTasks(plannerId: string, date: IsoDate): Task[] {
  return selectRows<Task>('task', plannerId, `date <= ? AND ${spanEnd} >= ?`, [date, date], byPosition);
}

/** Tasks appearing on any day of [from, to]. */
export function getTasksInRange(plannerId: string, from: IsoDate, to: IsoDate): Task[] {
  return selectRows<Task>('task', plannerId, `date <= ? AND ${spanEnd} >= ?`, [to, from], byPosition);
}

export function getWeeklyTodos(plannerId: string, weekKey: IsoDate): WeeklyTodo[] {
  return selectRows<WeeklyTodo>('weekly_todo', plannerId, 'week_key = ?', [weekKey], byPosition);
}

/** Whether taps are recorded as completions (per day) rather than the single `done` flag. */
export const taskUsesCompletions = (task: Task) => task.perDay !== null || task.spanDays !== null;
export const todoUsesCompletions = (todo: WeeklyTodo) => todo.targetType !== null;

const lastPosition = (items: { position: string }[]) => items.at(-1)?.position ?? null;

export function addTask(plannerId: string, date: IsoDate, title: string): void {
  const position = keyBetween(lastPosition(getTasks(plannerId, date)), null);
  writeFields('task', newId(), plannerId, {
    date,
    title: title.trim(),
    done: false,
    position,
    perDay: null,
    spanDays: null,
    deleted: false,
  });
}

export function addWeeklyTodo(plannerId: string, weekKey: IsoDate, title: string): void {
  const position = keyBetween(lastPosition(getWeeklyTodos(plannerId, weekKey)), null);
  writeFields('weekly_todo', newId(), plannerId, {
    weekKey,
    title: title.trim(),
    done: false,
    position,
    targetType: null,
    perDay: null,
    daysPerWeek: null,
    timesPerWeek: null,
    deleted: false,
  });
}

type Kind = 'task' | 'weekly_todo';

export const setDone = (kind: Kind, item: Task | WeeklyTodo, done: boolean) =>
  writeFields(kind, item.id, item.plannerId, { done });

export const renameItem = (kind: Kind, item: Task | WeeklyTodo, title: string) =>
  writeFields(kind, item.id, item.plannerId, { title: title.trim() });

export const deleteItem = (kind: Kind, item: Task | WeeklyTodo) =>
  writeFields(kind, item.id, item.plannerId, { deleted: true });

/** Move one step up or down: only the moved row's position changes. */
export function moveWithinList<T extends { id: string; plannerId: string; position: string }>(
  kind: Kind,
  list: T[],
  index: number,
  direction: -1 | 1,
): void {
  const target = index + direction;
  if (target < 0 || target >= list.length) return;
  const item = list[index]!;
  const without = list.filter((_, i) => i !== index);
  // After removing the item, insert it at `target`: between without[target-1] and without[target].
  const before = without[target - 1]?.position ?? null;
  const after = without[target]?.position ?? null;
  writeFields(kind, item.id, item.plannerId, { position: keyBetween(before, after) });
}

/**
 * Move a task to another day (appended at the end of that day). For a spread task this moves
 * the start of its span; counts on dates outside the new span are discarded (J4 — the UI
 * confirms first).
 */
export function moveTaskToDate(task: Task, date: IsoDate): void {
  if (task.date === date) return;
  const position = keyBetween(lastPosition(getTasks(task.plannerId, date)), null);
  writeFields('task', task.id, task.plannerId, { date, position });
  discardCompletionsOutside(task.plannerId, task.id, taskDates({ ...task, date }));
}

/**
 * Task target: N times a day (null = once) and an optional spread (2–31 days, null = that day).
 * Counts on dates outside the new span are discarded (J4 — the UI confirms first).
 */
export function setTaskTarget(task: Task, perDay: number | null, spanDays: number | null): void {
  writeFields('task', task.id, task.plannerId, { perDay, spanDays });
  discardCompletionsOutside(task.plannerId, task.id, taskDates({ date: task.date, perDay, spanDays }));
}

export function setTodoTarget(todo: WeeklyTodo, target: Target): void {
  writeFields('weekly_todo', todo.id, todo.plannerId, { ...target });
}
