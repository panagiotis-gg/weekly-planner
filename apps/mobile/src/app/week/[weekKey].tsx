import { isWeekKey, isValidIsoDate, shiftWeek, TEXT_LIMITS, weekKeyOf, WeeklyTodo } from '@planner/shared';
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useWeekData } from '@/data/queries';
import { setWeekNote } from '@/data/repositories/days';
import { Checklist } from '@/features/checklist/Checklist';
import { todoView } from '@/features/checklist/itemViews';
import { TodoCreateSheet, TodoTargetSheet } from '@/features/checklist/TargetSheets';
import { DayColumn } from '@/features/day/DayColumn';
import { HabitGrid } from '@/features/habits/HabitGrid';
import { MiniCalendars } from '@/features/week/MiniCalendars';
import { formatMonthDay, formatFullDate, todayIso } from '@/lib/format';
import { useCanEdit, usePlanner, usePlannerId, PlannerGate } from '@/state/planner';
import { Card, EditableText, IconButton, SectionTitle } from '@/ui/components';
import { usePalette } from '@/ui/theme';

/** Phones get the Week screen + day pager; ≥ 768 dp gets the multi-column week (DECISIONS F1, F2). */
const WIDE_BREAKPOINT = 768;

function WeekScreenContent() {
  const { weekKey } = useLocalSearchParams<{ weekKey: string }>();
  const planner = usePlanner();
  if (!weekKey || !isValidIsoDate(weekKey) || !isWeekKey(weekKey)) {
    return <Redirect href={{ pathname: '/week/[weekKey]', params: { weekKey: weekKeyOf(todayIso(), planner.weekStartDay) } }} />;
  }
  return <Week weekKey={weekKey} />;
}

function Week({ weekKey }: { weekKey: string }) {
  const { t } = useTranslation();
  const p = usePalette();
  const plannerId = usePlannerId();
  const planner = usePlanner();
  const canEdit = useCanEdit();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;
  const data = useWeekData(plannerId, weekKey);
  const { range } = data;

  const goToWeek = (key: string) => router.replace({ pathname: '/week/[weekKey]', params: { weekKey: key } });
  const currentKey = weekKeyOf(todayIso(), planner.weekStartDay);

  const header = (
    <View style={styles.weekHeader}>
      <IconButton glyph="‹" size={26} label={t('common.previous')} onPress={() => goToWeek(shiftWeek(weekKey, -1))} />
      <View style={styles.weekTitle}>
        <Text style={[styles.weekTitleText, { color: p.text }]}>
          {t('week.range', { start: formatMonthDay(range.start), end: formatFullDate(range.end) })}
        </Text>
        {weekKey !== currentKey ? (
          <Pressable onPress={() => goToWeek(currentKey)} accessibilityRole="button" hitSlop={6}>
            <Text style={{ color: p.accent, fontWeight: '600' }}>{t('common.today')}</Text>
          </Pressable>
        ) : null}
      </View>
      <IconButton glyph="›" size={26} label={t('common.next')} onPress={() => goToWeek(shiftWeek(weekKey, 1))} />
    </View>
  );

  const panel = (
    <View style={styles.panel}>
      <Card>
        <MiniCalendars range={range} plannerId={plannerId} habitRows={data.habitRows} />
      </Card>
      <Card>
        <SectionTitle>{t('week.habits')}</SectionTitle>
        <HabitGrid range={range} habits={data.habits} rows={data.habitRows} schedules={data.schedules} />
      </Card>
      <Card>
        <SectionTitle>{t('week.todos')}</SectionTitle>
        <Checklist
          kind="weekly_todo"
          items={data.todos}
          views={new Map(data.todos.map((todo) => [todo.id, todoView(todo, range, data.counts)]))}
          addPlaceholder={t('week.addTodo')}
          renderCreate={(close) => <TodoCreateSheet plannerId={plannerId} weekKey={weekKey} onDone={close} />}
          renderTargetEditor={(item, close) => <TodoTargetSheet todo={item as WeeklyTodo} onDone={close} />}
        />
      </Card>
      <Card>
        <SectionTitle>{t('week.note')}</SectionTitle>
        <EditableText
          value={data.weekNote?.body ?? ''}
          label={t('week.note')}
          placeholder={t('week.notePlaceholder')}
          maxLength={TEXT_LIMITS.note}
          multiline
          editable={canEdit}
          onSave={(body) => setWeekNote(plannerId, weekKey, body)}
        />
      </Card>
    </View>
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => <IconButton glyph="⚙" size={20} label={t('settings.title')} onPress={() => router.push('/settings')} />,
        }}
      />
      {wide ? (
        <ScrollView contentContainerStyle={styles.wideScroll}>
          {header}
          <View style={styles.wideBody}>
            <View style={styles.widePanel}>{panel}</View>
            <ScrollView horizontal contentContainerStyle={styles.columns} style={styles.columnsScroll}>
              {range.days.map((date) => (
                <DayColumn key={date} date={date} range={range} compact />
              ))}
            </ScrollView>
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.narrowScroll}>
          {header}
          {panel}
        </ScrollView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  weekHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  weekTitle: { flex: 1, alignItems: 'center', gap: 2 },
  weekTitleText: { fontSize: 18, fontWeight: '700' },
  panel: { gap: 12 },
  narrowScroll: { padding: 16, gap: 12 },
  wideScroll: { padding: 20, gap: 16 },
  wideBody: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  widePanel: { width: 360 },
  columnsScroll: { flex: 1 },
  columns: { gap: 14, paddingBottom: 8 },
});

/** Waits for the local database before rendering (see PlannerGate). */
export default function WeekScreen() {
  return (
    <PlannerGate>
      <WeekScreenContent />
    </PlannerGate>
  );
}
