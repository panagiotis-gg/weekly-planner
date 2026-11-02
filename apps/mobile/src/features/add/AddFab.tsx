import { IsoDate, WeekRange } from '@planner/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TaskCreateSheet, TodoCreateSheet } from '@/features/checklist/TargetSheets';
import { HabitEditor } from '@/features/habits/HabitGrid';
import { useCanEdit, usePlannerId } from '@/state/planner';
import { Button, pressedStyle, Sheet } from '@/ui/components';
import { usePalette } from '@/ui/theme';
import { useUndoStore } from '@/ui/undo';

type Creating = 'menu' | 'task' | 'todo' | 'habit' | null;

/** Screens leave this much room at the bottom so the button never covers the last row. */
export const FAB_ROOM = 88;

/**
 * Floating + on the week and day screens (DECISIONS L3): add an event, task, to-do or habit.
 * `date` is where a new event or task goes.
 */
export function AddFab({ date, range }: { date: IsoDate; range: WeekRange }) {
  const { t } = useTranslation();
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const plannerId = usePlannerId();
  const canEdit = useCanEdit();
  const undoShowing = useUndoStore((s) => s.offer !== null);
  const [creating, setCreating] = useState<Creating>(null);
  const close = () => setCreating(null);
  if (!canEdit) return null;

  const plain = (label: string) => label.replace(/…$/, '');
  return (
    <>
      <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + (undoShowing ? 76 : 20) }]}>
        <Pressable
          onPress={() => setCreating('menu')}
          accessibilityRole="button"
          accessibilityLabel={t('common.add')}
          style={({ pressed }) => [styles.fab, { backgroundColor: p.accent }, pressed && pressedStyle]}
        >
          <Text style={[styles.plus, { color: p.onAccent }]}>+</Text>
        </Pressable>
      </View>

      <Sheet visible={creating === 'menu'} onClose={close} title={t('common.add')}>
        <Button
          title={t('event.new')}
          variant="secondary"
          onPress={() => {
            close();
            router.push({ pathname: '/event', params: { date } });
          }}
        />
        <Button title={plain(t('day.addTask'))} variant="secondary" onPress={() => setCreating('task')} />
        <Button title={plain(t('week.addTodo'))} variant="secondary" onPress={() => setCreating('todo')} />
        <Button title={t('habit.new')} variant="secondary" onPress={() => setCreating('habit')} />
      </Sheet>

      <Sheet visible={creating === 'task'} onClose={close} title={plain(t('day.addTask'))}>
        {creating === 'task' ? <TaskCreateSheet plannerId={plannerId} date={date} onDone={close} /> : null}
      </Sheet>
      <Sheet visible={creating === 'todo'} onClose={close} title={plain(t('week.addTodo'))}>
        {creating === 'todo' ? <TodoCreateSheet plannerId={plannerId} weekKey={range.weekKey} onDone={close} /> : null}
      </Sheet>
      {creating === 'habit' ? (
        <HabitEditor habit={null} plannerId={plannerId} weekKey={range.weekKey} version={null} dates={range.days} onClose={close} />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: 20 },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  plus: { fontSize: 30, lineHeight: 34, fontWeight: '400' },
});
