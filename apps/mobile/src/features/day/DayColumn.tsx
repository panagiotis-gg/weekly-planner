import { addDays, IsoDate, isoWeekday, Occurrence, Task, TEXT_LIMITS, WeekRange } from '@planner/shared';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDayData } from '@/data/queries';
import { setDayNote, setFocus } from '@/data/repositories/days';
import { removeLatestCompletion } from '@/data/repositories/completions';
import { Checklist, DayCell } from '@/features/checklist/Checklist';
import { taskView } from '@/features/checklist/itemViews';
import { TaskCreateSheet, TaskTargetSheet } from '@/features/checklist/TargetSheets';
import { habitCell, habitStatus } from '@/features/habits/HabitGrid';
import { formatFullDate, formatTime, formatWeekday, todayIso, upper } from '@/lib/format';
import { useCanEdit, usePlanner, usePlannerId } from '@/state/planner';
import { Card, EditableText, IconButton, SectionTitle, textStyles } from '@/ui/components';
import { dayColor, usePalette } from '@/ui/theme';

/** One day: pastel header, today's focus, events, tasks and the day note (reference planner day column). */
export function DayColumn({ date, range, compact }: { date: IsoDate; range: WeekRange; compact?: boolean }) {
  const { t } = useTranslation();
  const p = usePalette();
  const text = textStyles(p);
  const plannerId = usePlannerId();
  const planner = usePlanner();
  const canEdit = useCanEdit();
  const { entry, tasks, occurrences, todaysHabits, counts, spanCounts } = useDayData(plannerId, date);
  const taskViews = new Map(tasks.map((task) => [task.id, taskView(task, date, counts, spanCounts)]));
  const color = dayColor(p, isoWeekday(date), planner.dayColors);
  const isToday = date === todayIso();
  // Tasks can move to any day of the displayed week, or one week ahead.
  const moveTargets = [...range.days, addDays(date, 7)];

  return (
    <View style={[styles.column, compact && styles.compact]}>
      <View style={[styles.header, { backgroundColor: color }]}>
        <Text style={[styles.dayName, { color: p.onDayColor }]}>{upper(formatWeekday(date))}</Text>
        <Text style={[styles.date, { color: p.onDayColor }]}>
          {formatFullDate(date)}
          {isToday ? ` · ${t('common.today')}` : ''}
        </Text>
      </View>

      <Card>
        <SectionTitle>{t('day.focus')}</SectionTitle>
        <EditableText
          value={entry?.focus ?? ''}
          label={t('day.focus')}
          placeholder={t('day.focusPlaceholder')}
          maxLength={TEXT_LIMITS.focus}
          editable={canEdit}
          onSave={(v) => setFocus(plannerId, date, v)}
          style={styles.focus}
        />
      </Card>

      <Card>
        <SectionTitle
          right={
            canEdit ? (
              <Pressable
                onPress={() => router.push({ pathname: '/event', params: { date } })}
                accessibilityRole="button"
                hitSlop={8}
              >
                <Text style={{ color: p.accent, fontWeight: '600' }}>+ {t('day.addEvent')}</Text>
              </Pressable>
            ) : null
          }
        >
          {t('day.events')}
        </SectionTitle>
        {occurrences.length === 0 ? <Text style={text.muted}>{t('common.noItems')}</Text> : null}
        {occurrences.map((o) => (
          <EventRow key={`${o.eventId}:${o.originalDate}`} occurrence={o} canEdit={canEdit} />
        ))}
      </Card>

      {todaysHabits.length > 0 ? (
        <Card>
          <SectionTitle>{t('day.habits')}</SectionTitle>
          {todaysHabits.map(({ habit, row }) => {
            const cell = habitCell(row, habit, date);
            const status = habitStatus(row);
            return (
              <View key={habit.id} style={styles.habitRow}>
                <Text style={[text.body, styles.flex]} numberOfLines={1}>
                  {habit.name}
                  {status ? <Text style={text.muted}>{`  ·  ${t('day.thisWeek')} ${status}`}</Text> : null}
                </Text>
                {cell && cell.kind === 'counter' && cell.count > 0 && canEdit ? (
                  <IconButton glyph="−" size={18} label={t('target.undoLastTap')} onPress={() => removeLatestCompletion(habit.plannerId, habit.id, date)} />
                ) : null}
                {cell ? <DayCell cell={cell} label={habit.name} color={color} /> : null}
              </View>
            );
          })}
        </Card>
      ) : null}

      <Card>
        <SectionTitle>{t('day.tasks')}</SectionTitle>
        <Checklist
          kind="task"
          items={tasks}
          views={taskViews}
          addPlaceholder={t('day.addTask')}
          renderCreate={(close) => <TaskCreateSheet plannerId={plannerId} date={date} onDone={close} />}
          moveTargets={moveTargets}
          progressColor={color}
          color={color}
          renderTargetEditor={(item, close) => <TaskTargetSheet task={item as Task} onDone={close} />}
        />
      </Card>

      <Card>
        <SectionTitle>{t('day.note')}</SectionTitle>
        <EditableText
          value={entry?.note ?? ''}
          label={t('day.note')}
          placeholder={t('day.notePlaceholder')}
          maxLength={TEXT_LIMITS.note}
          multiline
          editable={canEdit}
          onSave={(v) => setDayNote(plannerId, date, v)}
        />
      </Card>
    </View>
  );
}

function EventRow({ occurrence: o, canEdit }: { occurrence: Occurrence; canEdit: boolean }) {
  const { t } = useTranslation();
  const p = usePalette();
  const time = o.allDay
    ? t('day.allDay')
    : `${formatTime(o.startTime!)}${o.endTime ? ` – ${formatTime(o.endTime)}` : ''}`;
  return (
    <Pressable
      disabled={!canEdit}
      onPress={() =>
        router.push({ pathname: '/event', params: { eventId: o.eventId, originalDate: o.originalDate, date: o.date } })
      }
      accessibilityRole="button"
      style={styles.eventRow}
    >
      <Text style={[styles.eventTime, { color: p.textMuted }]}>{time}</Text>
      <Text style={{ color: p.text, flex: 1, fontSize: 15 }}>
        {o.title}
        {o.isRecurring ? <Text style={{ color: p.textMuted }}>  ↻</Text> : null}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  column: { gap: 12 },
  compact: { width: 320 },
  header: { borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center', gap: 2 },
  dayName: { fontSize: 15, fontWeight: '800', letterSpacing: 3 },
  date: { fontSize: 13, fontWeight: '600' },
  focus: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  eventRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, paddingVertical: 3 },
  habitRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  flex: { flex: 1 },
  eventTime: { width: 104, fontSize: 13, fontVariant: ['tabular-nums'] },
});
