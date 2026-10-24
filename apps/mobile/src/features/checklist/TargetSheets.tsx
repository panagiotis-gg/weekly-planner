import { Target, TARGET_LIMITS, Task, taskDates, WeeklyTodo } from '@planner/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { setTaskTarget, setTodoTarget } from '@/data/repositories/checklists';
import { countCompletionsOutside } from '@/data/repositories/completions';
import { TargetEditor } from '@/features/targets/TargetEditor';
import { Button, Stepper, textStyles } from '@/ui/components';
import { confirm } from '@/ui/confirm';
import { usePalette } from '@/ui/theme';
import { todoTarget } from './itemViews';

/** Day task target: N times a day, optionally spread over 2–31 consecutive days (J4, J12). */
export function TaskTargetSheet({ task, onDone }: { task: Task; onDone: () => void }) {
  const { t } = useTranslation();
  const p = usePalette();
  const text = textStyles(p);
  const [several, setSeveral] = useState(task.perDay !== null);
  const [perDay, setPerDay] = useState(task.perDay ?? 2);
  const [spread, setSpread] = useState(task.spanDays !== null);
  const [spanDays, setSpanDays] = useState(task.spanDays ?? 5);

  const save = () => {
    const nextPerDay = several ? perDay : null;
    const nextSpan = spread ? spanDays : null;
    const lost = countCompletionsOutside(task.plannerId, task.id, taskDates({ date: task.date, perDay: nextPerDay, spanDays: nextSpan }));
    const run = () => {
      setTaskTarget(task, nextPerDay, nextSpan);
      onDone();
    };
    if (lost > 0) confirm(t('target.discardConfirm', { count: lost }), run);
    else run();
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={[text.body, styles.label]}>{t('target.severalTimesADay')}</Text>
        <Switch value={several} onValueChange={setSeveral} accessibilityLabel={t('target.severalTimesADay')} />
      </View>
      {several ? (
        <View style={styles.row}>
          <Text style={[text.body, styles.label]}>{t('target.timesEachDay')}</Text>
          <Stepper label={t('target.timesEachDay')} value={perDay} min={TARGET_LIMITS.perDay.min} max={TARGET_LIMITS.perDay.max} onChange={setPerDay} />
        </View>
      ) : null}
      <View style={styles.row}>
        <Text style={[text.body, styles.label]}>{t('target.spread')}</Text>
        <Switch value={spread} onValueChange={setSpread} accessibilityLabel={t('target.spread')} />
      </View>
      {spread ? (
        <View style={styles.row}>
          <Text style={[text.body, styles.label]}>{t('target.spanDays')}</Text>
          <Stepper label={t('target.spanDays')} value={spanDays} min={TARGET_LIMITS.spanDays.min} max={TARGET_LIMITS.spanDays.max} onChange={setSpanDays} />
        </View>
      ) : null}
      <Text style={text.muted}>{t('target.taskHint')}</Text>
      <Button title={t('common.save')} onPress={save} />
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

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  label: { flex: 1 },
});
