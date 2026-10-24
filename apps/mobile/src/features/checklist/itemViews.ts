import {
  dailyGoal,
  evaluateTarget,
  IsoDate,
  isCheckboxTarget,
  Target,
  Task,
  taskDates,
  taskSpanPosition,
  WeekRange,
  WeeklyTodo,
} from '@planner/shared';
import { setDone, taskUsesCompletions, todoUsesCompletions } from '@/data/repositories/checklists';
import {
  addCompletion,
  removeLatestCompletion,
  removeLatestItemCompletion,
  setCheckedForDay,
} from '@/data/repositories/completions';
import i18n from '@/i18n';

type Counts = ReadonlyMap<string, ReadonlyMap<IsoDate, number>>;
const countOf = (counts: Counts, itemId: string, date: IsoDate) => counts.get(itemId)?.get(date) ?? 0;

/** A day cell of an item counted per day: checkbox or counter. */
export interface DayCellView {
  date: IsoDate;
  kind: 'check' | 'counter';
  count: number;
  goal: number | null;
  met: boolean;
  onPress: () => void;
}

/** How one checklist row renders and what it contributes to the list % (J5, J6). */
export interface ItemView {
  /** done: the item's own flag (no target); cell: one day cell inline (tasks). */
  control: 'done' | 'cell' | 'none';
  checked: boolean;
  cell?: DayCellView;
  /** Partial credit 0..1 for the list progress. */
  fraction: number;
  struck: boolean;
  status?: string;
  /** Day strip for weekly to-dos with a target. */
  strip?: DayCellView[];
  onToggle?: () => void;
  onUndo?: () => void;
}

/** A day task on `date`: once (flag), once a day across a span, or N times a day (J4). */
export function taskView(task: Task, date: IsoDate, counts: Counts, spanCounts: Counts): ItemView {
  if (!taskUsesCompletions(task)) {
    return {
      control: 'done',
      checked: task.done,
      fraction: task.done ? 1 : 0,
      struck: task.done,
      onToggle: () => setDone('task', task, !task.done),
    };
  }
  const goal = task.perDay ?? 1;
  const count = countOf(counts, task.id, date);
  const met = count >= goal;
  const cell: DayCellView = {
    date,
    kind: task.perDay === null ? 'check' : 'counter',
    count,
    goal: task.perDay === null ? null : goal,
    met,
    onPress:
      task.perDay === null
        ? () => setCheckedForDay(task.plannerId, 'task', task.id, date, !met)
        : () => addCompletion(task.plannerId, 'task', task.id, date),
  };
  let status: string | undefined;
  if (task.spanDays !== null) {
    const { day, of } = taskSpanPosition(task, date);
    const all = taskDates(task).every((d) => (spanCounts.get(task.id)?.get(d) ?? 0) >= goal);
    status = all ? i18n.t('target.spanAllDone', { of }) : i18n.t('target.spanDay', { day, of });
  }
  return {
    control: 'cell',
    checked: met,
    cell,
    fraction: Math.min(count, goal) / goal,
    struck: met,
    status,
    onUndo: count > 0 ? () => removeLatestCompletion(task.plannerId, task.id, date) : undefined,
  };
}

export function todoTarget(todo: WeeklyTodo): Target {
  return { targetType: todo.targetType, perDay: todo.perDay, daysPerWeek: todo.daysPerWeek, timesPerWeek: todo.timesPerWeek };
}

/** Status line for a target evaluation, e.g. "2/3 days" or "7/10 times". */
export function summaryText(summary: { unit: 'days' | 'times'; value: number; goal: number }): string {
  return i18n.t(summary.unit === 'days' ? 'target.summaryDays' : 'target.summaryTimes', summary);
}

/** A weekly to-do: its own flag, or a target over the 7 days of its week with a day strip (J3). */
export function todoView(todo: WeeklyTodo, range: WeekRange, counts: Counts): ItemView {
  if (!todoUsesCompletions(todo)) {
    return {
      control: 'done',
      checked: todo.done,
      fraction: todo.done ? 1 : 0,
      struck: todo.done,
      onToggle: () => setDone('weekly_todo', todo, !todo.done),
    };
  }
  const target = todoTarget(todo);
  const itemCounts = counts.get(todo.id) ?? new Map<IsoDate, number>();
  const evaluation = evaluateTarget(target, range.days, itemCounts);
  const checkbox = isCheckboxTarget(target);
  const goal = dailyGoal(target);
  const strip: DayCellView[] = evaluation.days.map((d) => ({
    date: d.date,
    kind: checkbox ? 'check' : 'counter',
    count: d.count,
    goal: target.targetType === 'times_per_week' ? null : goal,
    met: target.targetType === 'times_per_week' ? false : d.met,
    onPress: checkbox
      ? () => setCheckedForDay(todo.plannerId, 'weekly_todo', todo.id, d.date, !d.met)
      : () => addCompletion(todo.plannerId, 'weekly_todo', todo.id, d.date),
  }));
  const anyTaps = evaluation.days.some((d) => d.count > 0);
  return {
    control: 'none',
    checked: evaluation.achieved === true,
    fraction: (evaluation.percent ?? 0) / 100,
    struck: evaluation.achieved === true,
    status: `${evaluation.achieved ? '✓ ' : ''}${summaryText(evaluation.summary)}`,
    strip,
    onUndo: anyTaps ? () => removeLatestItemCompletion(todo.plannerId, todo.id) : undefined,
  };
}
