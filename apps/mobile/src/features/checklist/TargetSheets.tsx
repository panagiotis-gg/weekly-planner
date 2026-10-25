import { IsoDate, NO_TARGET, Target, TARGET_LIMITS, Task, taskDates, TEXT_LIMITS, weekRange, WeeklyTodo } from '@planner/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Switch, Text, View } from 'react-native';
import {
  addTask,
  addWeeklyTodo,
  NO_DUE,
  setTaskTarget,
  setTaskTime,
  setTodoDue,
  setTodoTarget,
  TodoDue,
} from '@/data/repositories/checklists';
import { countCompletionsOutside } from '@/data/repositories/completions';
import { getItemOffsets, setItemReminders } from '@/data/repositories/reminders';
import { ReminderPicker } from '@/features/reminders/ReminderPicker';
import { TargetEditor } from '@/features/targets/TargetEditor';
import { formatMonthDay, formatWeekday } from '@/lib/format';
import { usePlanner } from '@/state/planner';
import { Button, Chip, Field, Stepper, textStyles } from '@/ui/components';
import { confirm } from '@/ui/confirm';
import { TimeField } from '@/ui/pickers';
import { usePalette } from '@/ui/theme';
import { todoTarget } from './itemViews';

interface TaskTargetValue {
  /** N times a day; null = once. */
  perDay: number | null;
  /** Consecutive days; null = that day only. */
  spanDays: number | null;
}

/** Optional time of day (K4, K5); reminders count from it, or from 09:00. */
function TimeRow({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const { t } = useTranslation();
  const p = usePalette();
  const text = textStyles(p);
  return (
    <>
      <Text style={text.muted}>{t('item.time')}</Text>
      <TimeField value={value} onChange={onChange} label={t('item.time')} clearable />
    </>
  );
}

/** Optional due day within the to-do's week, and optional time on it (K5). */
function TodoDueFields({ weekKey, value, onChange }: { weekKey: IsoDate; value: TodoDue; onChange: (v: TodoDue) => void }) {
  const { t } = useTranslation();
  const p = usePalette();
  const text = textStyles(p);
  const planner = usePlanner();
  const days = weekRange(weekKey, planner.weekStartDay).days;
  return (
    <>
      <Text style={text.muted}>{t('todoDue.title')}</Text>
      <View style={styles.chips}>
        <Chip label={t('todoDue.none')} selected={value.dueDate === null} onPress={() => onChange(NO_DUE)} />
        {days.map((date) => (
          <Chip
            key={date}
            label={`${formatWeekday(date, 'short')} ${formatMonthDay(date)}`}
            selected={value.dueDate === date}
            onPress={() => onChange({ ...value, dueDate: date })}
          />
        ))}
      </View>
      {value.dueDate !== null ? <TimeRow value={value.dueTime} onChange={(dueTime) => onChange({ ...value, dueTime })} /> : null}
    </>
  );
}

/** A to-do's reminders need its due day (K5); without a time they count from 09:00. */
function TodoReminders({ due, value, onChange }: { due: TodoDue; value: number[]; onChange: (v: number[]) => void }) {
  const { t } = useTranslation();
  return (
    <ReminderPicker
      value={value}
      onChange={onChange}
      disabledHint={due.dueDate ? undefined : t('reminder.needsDueDay')}
      hint={due.dueTime ? undefined : t('reminder.noTimeHint')}
    />
  );
}

/** Times a day and spread controls shared by "New task" and the task's "Details…" (J4, J12). */
function TaskTargetFields({ value, onChange }: { value: TaskTargetValue; onChange: (v: TaskTargetValue) => void }) {
  const { t } = useTranslation();
  const p = usePalette();
  const text = textStyles(p);
  return (
    <>
      <View style={styles.row}>
        <Text style={[text.body, styles.label]}>{t('target.severalTimesADay')}</Text>
        <Switch
          value={value.perDay !== null}
          onValueChange={(on) => onChange({ ...value, perDay: on ? 2 : null })}
          accessibilityLabel={t('target.severalTimesADay')}
        />
      </View>
      {value.perDay !== null ? (
        <View style={styles.row}>
          <Text style={[text.body, styles.label]}>{t('target.timesEachDay')}</Text>
          <Stepper
            label={t('target.timesEachDay')}
            value={value.perDay}
            min={TARGET_LIMITS.perDay.min}
            max={TARGET_LIMITS.perDay.max}
            onChange={(perDay) => onChange({ ...value, perDay })}
          />
        </View>
      ) : null}
      <View style={styles.row}>
        <Text style={[text.body, styles.label]}>{t('target.spread')}</Text>
        <Switch
          value={value.spanDays !== null}
          onValueChange={(on) => onChange({ ...value, spanDays: on ? 5 : null })}
          accessibilityLabel={t('target.spread')}
        />
      </View>
      {value.spanDays !== null ? (
        <View style={styles.row}>
          <Text style={[text.body, styles.label]}>{t('target.spanDays')}</Text>
          <Stepper
            label={t('target.spanDays')}
            value={value.spanDays}
            min={TARGET_LIMITS.spanDays.min}
            max={TARGET_LIMITS.spanDays.max}
            onChange={(spanDays) => onChange({ ...value, spanDays })}
          />
        </View>
      ) : null}
      <Text style={text.muted}>{t('target.taskHint')}</Text>
    </>
  );
}

/** A day task's details: time, reminders, and target (N times a day, optionally spread — J4, J12, K4). */
export function TaskTargetSheet({ task, onDone }: { task: Task; onDone: () => void }) {
  const { t } = useTranslation();
  const [value, setValue] = useState<TaskTargetValue>({ perDay: task.perDay, spanDays: task.spanDays });
  const [time, setTime] = useState(task.time);
  const [offsets, setOffsets] = useState(() => getItemOffsets(task.plannerId, task.id));

  const save = () => {
    const lost = countCompletionsOutside(task.plannerId, task.id, taskDates({ date: task.date, ...value }));
    const run = () => {
      setTaskTarget(task, value.perDay, value.spanDays);
      setTaskTime(task, time);
      setItemReminders(task.plannerId, 'task', task.id, offsets);
      onDone();
    };
    if (lost > 0) confirm(t('target.discardConfirm', { count: lost }), run);
    else run();
  };

  return (
    <View style={styles.wrap}>
      <TimeRow value={time} onChange={setTime} />
      <ReminderPicker value={offsets} onChange={setOffsets} hint={time ? undefined : t('reminder.noTimeHint')} />
      <TaskTargetFields value={value} onChange={setValue} />
      <Button title={t('common.save')} onPress={save} />
      <Button title={t('common.cancel')} variant="secondary" onPress={onDone} />
    </View>
  );
}

/** New day task: title, time, reminders, times a day and spread in one dialog (J4, K4). */
export function TaskCreateSheet({ plannerId, date, onDone }: { plannerId: string; date: IsoDate; onDone: () => void }) {
  const { t } = useTranslation();
  const p = usePalette();
  const text = textStyles(p);
  const [title, setTitle] = useState('');
  const [value, setValue] = useState<TaskTargetValue>({ perDay: null, spanDays: null });
  const [time, setTime] = useState<string | null>(null);
  const [offsets, setOffsets] = useState<number[]>([]);
  const save = () => {
    if (!title.trim()) return;
    const id = addTask(plannerId, date, title, value.perDay, value.spanDays, time);
    if (offsets.length > 0) setItemReminders(plannerId, 'task', id, offsets);
    onDone();
  };
  return (
    <View style={styles.wrap}>
      <Text style={text.muted}>{t('event.title')}</Text>
      <Field
        value={title}
        onChangeText={setTitle}
        onSubmitEditing={save}
        autoFocus
        maxLength={TEXT_LIMITS.title}
        placeholder={t('task.titlePlaceholder')}
        accessibilityLabel={t('event.title')}
      />
      <TimeRow value={time} onChange={setTime} />
      <ReminderPicker value={offsets} onChange={setOffsets} hint={time ? undefined : t('reminder.noTimeHint')} />
      <TaskTargetFields value={value} onChange={setValue} />
      <Button title={t('common.save')} onPress={save} disabled={!title.trim()} />
      <Button title={t('common.cancel')} variant="secondary" onPress={onDone} />
    </View>
  );
}

/** A weekly to-do's details: due day, reminders, and target over the 7 days of its week (J3, K5). */
export function TodoTargetSheet({ todo, onDone }: { todo: WeeklyTodo; onDone: () => void }) {
  const { t } = useTranslation();
  const [target, setTarget] = useState<Target>(todoTarget(todo));
  const [due, setDue] = useState<TodoDue>({ dueDate: todo.dueDate, dueTime: todo.dueTime });
  const [offsets, setOffsets] = useState(() => getItemOffsets(todo.plannerId, todo.id));
  return (
    <View style={styles.wrap}>
      <TodoDueFields weekKey={todo.weekKey} value={due} onChange={setDue} />
      <TodoReminders due={due} value={offsets} onChange={setOffsets} />
      <TargetEditor value={target} onChange={setTarget} maxDays={7} />
      <Button
        title={t('common.save')}
        onPress={() => {
          setTodoTarget(todo, target);
          setTodoDue(todo, due);
          // Without a due day a to-do has no reminders (K5).
          setItemReminders(todo.plannerId, 'weekly_todo', todo.id, due.dueDate ? offsets : []);
          onDone();
        }}
      />
      <Button title={t('common.cancel')} variant="secondary" onPress={onDone} />
    </View>
  );
}

/** New weekly to-do: title, due day, reminders and an optional target in one dialog (J3, K5). */
export function TodoCreateSheet({ plannerId, weekKey, onDone }: { plannerId: string; weekKey: IsoDate; onDone: () => void }) {
  const { t } = useTranslation();
  const p = usePalette();
  const text = textStyles(p);
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState<Target>(NO_TARGET);
  const [due, setDue] = useState<TodoDue>(NO_DUE);
  const [offsets, setOffsets] = useState<number[]>([]);
  const save = () => {
    if (!title.trim()) return;
    const id = addWeeklyTodo(plannerId, weekKey, title, target, due);
    if (due.dueDate && offsets.length > 0) setItemReminders(plannerId, 'weekly_todo', id, offsets);
    onDone();
  };
  return (
    <View style={styles.wrap}>
      <Text style={text.muted}>{t('event.title')}</Text>
      <Field
        value={title}
        onChangeText={setTitle}
        onSubmitEditing={save}
        autoFocus
        maxLength={TEXT_LIMITS.title}
        placeholder={t('todo.titlePlaceholder')}
        accessibilityLabel={t('event.title')}
      />
      <TodoDueFields weekKey={weekKey} value={due} onChange={setDue} />
      <TodoReminders due={due} value={offsets} onChange={setOffsets} />
      <TargetEditor value={target} onChange={setTarget} maxDays={7} />
      <Button title={t('common.save')} onPress={save} disabled={!title.trim()} />
      <Button title={t('common.cancel')} variant="secondary" onPress={onDone} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  label: { flex: 1 },
});
