import { addDays, IsoDate, isValidIsoDate, weekKeyOf, weekRange } from '@planner/shared';
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { AddFab, FAB_ROOM } from '@/features/add/AddFab';
import { DayColumn } from '@/features/day/DayColumn';
import { formatWeekday, todayIso } from '@/lib/format';
import { PlannerGate, usePlanner } from '@/state/planner';
import { IconButton } from '@/ui/components';
import { usePageSwipe } from '@/ui/gestures';
import { RiseIn } from '@/ui/motion';
import { usePalette } from '@/ui/theme';

function DayScreenContent() {
  const { date } = useLocalSearchParams<{ date: string }>();
  if (!date || !isValidIsoDate(date)) return <Redirect href={{ pathname: '/day/[date]', params: { date: todayIso() } }} />;
  return <DayPage date={date} />;
}

/**
 * One day, driven only by the URL (DECISIONS F2). Swiping left/right or the ‹ › arrows move to the
 * next/previous day by changing the URL, crossing week boundaries.
 *
 * Deliberately not a scroll-positioned horizontal list: on iPhone Safari that list reported the
 * previous day while positioning itself, and writing it back into the URL stepped back endlessly.
 * Here nothing writes the URL except an explicit swipe or tap, so there is no loop.
 */
function DayPage({ date }: { date: IsoDate }) {
  const { t } = useTranslation();
  const p = usePalette();
  const planner = usePlanner();
  const weekKey = weekKeyOf(date, planner.weekStartDay);
  const range = weekRange(weekKey, planner.weekStartDay);

  const swipe = usePageSwipe((step) => router.setParams({ date: addDays(date, step) }));

  return (
    <View style={styles.flex} {...swipe}>
      <Stack.Screen
        options={{
          title: formatWeekday(date),
          headerLeft: () => (
            <IconButton
              glyph={`‹ ${t('day.backToWeek')}`}
              size={16}
              color={p.accent}
              label={t('day.backToWeek')}
              onPress={() => router.replace({ pathname: '/week/[weekKey]', params: { weekKey } })}
            />
          ),
          headerRight: () => (
            <View style={styles.arrows}>
              <IconButton glyph="‹" size={24} label={t('common.previous')} onPress={() => router.setParams({ date: addDays(date, -1) })} />
              <IconButton glyph="›" size={24} label={t('common.next')} onPress={() => router.setParams({ date: addDays(date, 1) })} />
            </View>
          ),
        }}
      />
      {/* key: a new day starts scrolled to the top. */}
      <ScrollView key={date} contentContainerStyle={styles.page}>
        <RiseIn>
          <DayColumn date={date} range={range} />
        </RiseIn>
      </ScrollView>
      <AddFab date={date} range={range} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { padding: 16, paddingBottom: FAB_ROOM, maxWidth: 640, width: '100%', alignSelf: 'center' },
  arrows: { flexDirection: 'row', gap: 4 },
});

/** Waits for the local database before rendering (see PlannerGate). */
export default function DayScreen() {
  return (
    <PlannerGate>
      <DayScreenContent />
    </PlannerGate>
  );
}
