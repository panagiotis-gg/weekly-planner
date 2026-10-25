import {
  ALL_DAYS_MASK,
  dailyGoal,
  Habit,
  habitProgress,
  HabitSchedule,
  HabitScheduleLike,
  HabitWeekRow,
  IsoDate,
  IsoWeekday,
  isCheckboxTarget,
  isoWeekday,
  maskFromWeekdays,
  maskIncludes,
  scheduleVersionForWeek,
  Target,
  targetOf,
  TEXT_LIMITS,
  WeekRange,
  weekdaysFromMask,
} from '@planner/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { addCompletion, removeLatestItemCompletion, setCheckedForDay } from '@/data/repositories/completions';
import {
  addHabit,
  deleteHabit,
  renameHabit,
  setHabitPlan,
  setHabitTime,
  setHideWhenAchieved,
  stopTrackingHabit,
} from '@/data/repositories/habits';
import { getItemOffsets, setItemReminders } from '@/data/repositories/reminders';
import { DayCell } from '@/features/checklist/Checklist';
import { DayCellView, summaryText } from '@/features/checklist/itemViews';
import { ReminderPicker } from '@/features/reminders/ReminderPicker';
import { TargetEditor } from '@/features/targets/TargetEditor';
import { TimeField } from '@/ui/pickers';
import { formatTime, formatWeekday } from '@/lib/format';
import { useCanEdit, useDayColorFor, usePlannerId } from '@/state/planner';
import { AddButton, Button, Chip, Field, ProgressBar, Sheet, textStyles } from '@/ui/components';
import { confirm } from '@/ui/confirm';
import { usePalette } from '@/ui/theme';

/** A habit's cell for one day: checkbox when once a day is enough, otherwise a counter (J6). */
export function habitCell(row: HabitWeekRow, habit: Habit, date: IsoDate): DayCellView | null {
  const day = row.days.find((d) => d.date === date);
  if (!day?.scheduled) return null;
  const checkbox = isCheckboxTarget(row.target);
  return {
    date,
    kind: checkbox ? 'check' : 'counter',
    count: day.count,
    goal: row.target.targetType === 'times_per_week' ? null : dailyGoal(row.target),
    met: row.target.targetType === 'times_per_week' ? false : day.met,
    onPress: checkbox
      ? () => setCheckedForDay(habit.plannerId, 'habit', habit.id, date, !day.met)
      : () => addCompletion(habit.plannerId, 'habit', habit.id, date),
  };
}

/** Status shown at the end of a habit's row: "2/3 days", "7/10 times", ✓ when achieved (J11). */
export function habitStatus(row: HabitWeekRow): string | null {
  if (!row.target.targetType) return null;
  return `${row.evaluation.achieved ? '✓ ' : ''}${summaryText(row.evaluation.summary)}`;
}

/** Weekly habits: a cell per selected day, a status per habit, overall % = average of habits (J10). */
export function HabitGrid({
  range,
  habits,
  rows,
  schedules,
}: {
  range: WeekRange;
  habits: Habit[];
  rows: HabitWeekRow[];
  schedules: HabitSchedule[];
}) {
  const { t } = useTranslation();
  const p = usePalette();
  const text = textStyles(p);
  const plannerId = usePlannerId();
  const canEdit = useCanEdit();
  const colorFor = useDayColorFor();
  // null = closed, 'new' = create dialog, a habit = edit dialog.
  const [editing, setEditing] = useState<Habit | 'new' | null>(null);
  const byId = new Map(habits.map((h) => [h.id, h]));

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.nameCell} />
        {range.days.map((d) => (
          <Text key={d} style={[styles.dayHead, { color: p.textMuted }]}>
            {formatWeekday(d, 'narrow')}
          </Text>
        ))}
      </View>
      {rows.length === 0 ? <Text style={text.muted}>{t('week.noHabits')}</Text> : null}
      {rows.map((row) => {
        const habit = byId.get(row.habitId)!;
        // The habit's time, if any, before its target status (K4).
        const status = [habit.time ? formatTime(habit.time) : null, habitStatus(row)].filter(Boolean).join(' · ') || null;
        const achieved = row.evaluation.achieved === true;
        return (
          <View key={row.habitId} style={[styles.habit, achieved && { backgroundColor: p.surfaceMuted }]}>
            <View style={styles.row}>
              <Text
                style={[styles.nameCell, text.body]}
                numberOfLines={1}
                onPress={canEdit ? () => setEditing(habit) : undefined}
                accessibilityRole={canEdit ? 'button' : 'text'}
              >
                {habit.name}
              </Text>
              {range.days.map((date) => {
                const cell = habitCell(row, habit, date);
                return (
                  <View key={date} style={styles.cell}>
                    {cell ? (
                      <DayCell cell={cell} label={`${habit.name} ${formatWeekday(date, 'short')}`} compact color={colorFor(date)} />
                    ) : (
                      <Text style={{ color: p.border }} accessibilityLabel={t('habit.notScheduled')}>
                        –
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
            {status ? <Text style={[styles.status, { color: achieved ? p.accent : p.textMuted }]}>{status}</Text> : null}
          </View>
        );
      })}
      <ProgressBar percent={habitProgress(rows).percent} />
      {canEdit ? (
        <AddButton label={t('week.addHabit')} onPress={() => setEditing('new')} />
      ) : null}
      {editing ? (
        <HabitEditor
          habit={editing === 'new' ? null : editing}
          plannerId={plannerId}
          weekKey={range.weekKey}
          version={editing === 'new' ? null : scheduleVersionForWeek(editing.id, schedules, range.weekKey)}
          dates={range.days}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </View>
  );
}

/** Create (habit = null) or edit a habit: name, days, target and the hide-when-achieved setting. */
function HabitEditor({
  habit,
  plannerId,
  weekKey,
  version,
  dates,
  onClose,
}: {
  habit: Habit | null;
  plannerId: string;
  weekKey: string;
  version: HabitScheduleLike | null;
  /** The displayed week's dates, so chips follow its order (Mon- or Sun-first). */
  dates: IsoDate[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const p = usePalette();
  const text = textStyles(p);
  const [name, setName] = useState(habit?.name ?? '');
  const [selected, setSelected] = useState<IsoWeekday[]>(weekdaysFromMask(version?.weekdays ?? ALL_DAYS_MASK));
  const [target, setTarget] = useState<Target>(targetOf(version));
  const [hide, setHide] = useState(habit?.hideWhenAchieved ?? false);
  const [time, setTime] = useState<string | null>(habit?.time ?? null);
  const [offsets, setOffsets] = useState<number[]>(() => (habit ? getItemOffsets(plannerId, habit.id) : []));

  const save = () => {
    const days = selected.length;
    if (!name.trim() || days === 0) return;
    // "N days a week" can't exceed the selected days (J2, J12).
    const fitted = target.daysPerWeek !== null ? { ...target, daysPerWeek: Math.min(target.daysPerWeek, days) } : target;
    if (!habit) {
      const id = addHabit(plannerId, weekKey, name, maskFromWeekdays(selected), fitted, hide, time);
      if (offsets.length > 0) setItemReminders(plannerId, 'habit', id, offsets);
    } else {
      if (name !== habit.name) renameHabit(habit, name);
      if (hide !== habit.hideWhenAchieved) setHideWhenAchieved(habit, hide);
      setHabitTime(habit, time);
      setHabitPlan(habit.plannerId, habit.id, weekKey, maskFromWeekdays(selected), fitted);
      setItemReminders(habit.plannerId, 'habit', habit.id, offsets);
    }
    onClose();
  };

  return (
    <Sheet visible onClose={onClose} title={t(habit ? 'habit.edit' : 'habit.new')}>
      <Text style={text.muted}>{t('habit.name')}</Text>
      <Field
        value={name}
        onChangeText={setName}
        autoFocus={!habit}
        maxLength={TEXT_LIMITS.habitName}
        placeholder={t('habit.namePlaceholder')}
        accessibilityLabel={t('habit.name')}
      />
      <Text style={text.muted}>{t('habit.days')}</Text>
      <View style={styles.chips}>
        {dates.map((date) => {
          const d = isoWeekday(date);
          return (
            <Chip
              key={date}
              label={formatWeekday(date, 'short')}
              selected={maskIncludes(maskFromWeekdays(selected), d)}
              onPress={() => setSelected((s) => (s.includes(d) ? s.filter((x) => x !== d) : [...s, d]))}
            />
          );
        })}
      </View>
      <Text style={text.muted}>{t('item.time')}</Text>
      <TimeField value={time} onChange={setTime} label={t('item.time')} clearable />
      <ReminderPicker value={offsets} onChange={setOffsets} hint={time ? undefined : t('reminder.noTimeHint')} />
      <TargetEditor value={target} onChange={setTarget} maxDays={selected.length} />
      {habit ? <Text style={text.muted}>{t('habit.daysHint')}</Text> : null}
      {target.targetType ? (
        <View style={styles.switchRow}>
          <Text style={[text.body, styles.flex]}>{t('habit.hideWhenAchieved')}</Text>
          <Switch value={hide} onValueChange={setHide} accessibilityLabel={t('habit.hideWhenAchieved')} />
        </View>
      ) : null}
      <Button title={t('common.save')} onPress={save} disabled={selected.length === 0 || !name.trim()} />
      {habit ? (
        <HabitActions habit={habit} weekKey={weekKey} onClose={onClose} />
      ) : (
        <Button title={t('common.cancel')} variant="secondary" onPress={onClose} />
      )}
    </Sheet>
  );
}

/** Edit-only actions: undo a tap, stop tracking, delete. */
function HabitActions({ habit, weekKey, onClose }: { habit: Habit; weekKey: string; onClose: () => void }) {
  const { t } = useTranslation();
  const p = usePalette();
  const text = textStyles(p);
  return (
    <>
      <View style={styles.actionRow}>
        <View style={styles.flex}>
          <Button title={t('target.undoLastTap')} variant="secondary" onPress={() => removeLatestItemCompletion(habit.plannerId, habit.id)} />
        </View>
        <View style={styles.flex}>
          <Button
            title={t('habit.stopTracking')}
            variant="secondary"
            onPress={() => {
              stopTrackingHabit(habit, weekKey);
              onClose();
            }}
          />
        </View>
      </View>
      <Text style={text.muted}>{t('habit.stopTrackingHint')}</Text>
      <Button
        title={t('habit.delete')}
        variant="danger"
        onPress={() =>
          confirm(t('habit.deleteConfirm', { name: habit.name }), () => {
            deleteHabit(habit);
            onClose();
          })
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  habit: { borderRadius: 8, paddingVertical: 2, paddingHorizontal: 2 },
  row: { flexDirection: 'row', alignItems: 'center' },
  nameCell: { flex: 1, minWidth: 90, paddingRight: 6 },
  dayHead: { width: 34, textAlign: 'center', fontSize: 12, fontWeight: '600' },
  cell: { width: 34, alignItems: 'center', paddingVertical: 3 },
  status: { fontSize: 13, marginTop: -2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actionRow: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
});
