import { IsoDate, NO_TARGET, Target, TARGET_LIMITS, Task, taskDates, TEXT_LIMITS, WeeklyTodo } from '@planner/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { addTask, addWeeklyTodo, setTaskTarget, setTodoTarget } from '@/data/repositories/checklists';
import { countCompletionsOutside } from '@/data/repositories/completions';
import { TargetEditor } from '@/features/targets/TargetEditor';
import { Button, Field, Stepper, textStyles } from '@/ui/components';
import { confirm } from '@/ui/confirm';
import { usePalette } from '@/ui/theme';
import { todoTarget } from './itemViews';

interface TaskTargetValue {
  /** N times a day; null = once. */
  perDay: number | null;
  /** Consecutive days; null = that day only. */
  spanDays: number | null;
}

/** Times a day and spread controls shared by "New task" and the task's "Target…" (J4, J12). */
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

/** Day task target: N times a day, optionally spread over 2–31 consecutive days (J4, J12). */
export function TaskTargetSheet({ task, onDone }: { task: Task; onDone: () => void }) {
  const { t } = useTranslation();
  const [value, setValue] = useState<TaskTargetValue>({ perDay: task.perDay, spanDays: task.spanDays });

  const save = () => {
    const lost = countCompletionsOutside(task.plannerId, task.id, taskDates({ date: task.date, ...value }));
    const run = () => {
      setTaskTarget(task, value.perDay, value.spanDays);
      onDone();
    };
    if (lost > 0) confirm(t('target.discardConfirm', { count: lost }), run);
    else run();
  };

  return (
    <View style={styles.wrap}>
      <TaskTargetFields value={value} onChange={setValue} />
      <Button title={t('common.save')} onPress={save} />
      <Button title={t('common.cancel')} variant="secondary" onPress={onDone} />
    </View>
  );
}

/** New day task: title, times a day and spread in one dialog (J4). */
export function TaskCreateSheet({ plannerId, date, onDone }: { plannerId: string; date: IsoDate; onDone: () => void }) {
  const { t } = useTranslation();
  const p = usePalette();
  const text = textStyles(p);
  const [title, setTitle] = useState('');
  const [value, setValue] = useState<TaskTargetValue>({ perDay: null, spanDays: null });
  const save = () => {
    if (!title.trim()) return;
    addTask(plannerId, date, title, value.perDay, value.spanDays);
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
      <TaskTargetFields value={value} onChange={setValue} />
      <Button title={t('common.save')} onPress={save} disabled={!title.trim()} />
      <Button title={t('common.cancel')} variant="secondary" onPress={onDone} />
    </View>
  );
}

/** Weekly to-do target: the four types over the 7 days of its week (J3). */
export function TodoTargetSheet({ todo, onDone }: { todo: WeeklyTodo; onDone: () => void }) {
  const { t } = useTranslation();
  const [target, setTarget] = useState<Target>(todoTarget(todo));
  return (
    <View style={styles.wrap}>
      <TargetEditor value={target} onChange={setTarget} maxDays={7} />
      <Button
        title={t('common.save')}
        onPress={() => {
          setTodoTarget(todo, target);
          onDone();
        }}
      />
      <Button title={t('common.cancel')} variant="secondary" onPress={onDone} />
    </View>
  );
}

/** New weekly to-do: title and an optional target in one dialog (J3). */
export function TodoCreateSheet({ plannerId, weekKey, onDone }: { plannerId: string; weekKey: IsoDate; onDone: () => void }) {
  const { t } = useTranslation();
  const p = usePalette();
  const text = textStyles(p);
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState<Target>(NO_TARGET);
  const save = () => {
    if (!title.trim()) return;
    addWeeklyTodo(plannerId, weekKey, title, target);
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
      <TargetEditor value={target} onChange={setTarget} maxDays={7} />
      <Button title={t('common.save')} onPress={save} disabled={!title.trim()} />
      <Button title={t('common.cancel')} variant="secondary" onPress={onDone} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  label: { flex: 1 },
});
