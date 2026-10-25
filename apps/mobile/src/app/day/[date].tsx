import { addDays, IsoDate, isValidIsoDate, weekKeyOf, weekRange } from '@planner/shared';
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PanResponder, ScrollView, StyleSheet, View } from 'react-native';
import { DayColumn } from '@/features/day/DayColumn';
import { formatWeekday, todayIso } from '@/lib/format';
import { PlannerGate, usePlanner } from '@/state/planner';
import { IconButton } from '@/ui/components';
import { usePalette } from '@/ui/theme';

/** Horizontal distance (px) a swipe must travel to change the day. */
const SWIPE_DISTANCE = 60;

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

  const swipe = useMemo(() => {
    const go = (step: number) => router.setParams({ date: addDays(date, step) });
    return PanResponder.create({
      // Claim only clearly horizontal drags, so vertical scrolling of the day keeps working.
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onPanResponderRelease: (_, g) => {
        if (g.dx <= -SWIPE_DISTANCE) go(1);
        else if (g.dx >= SWIPE_DISTANCE) go(-1);
      },
    });
  }, [date]);

  return (
    <View style={styles.flex} {...swipe.panHandlers}>
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
        <DayColumn date={date} range={weekRange(weekKey, planner.weekStartDay)} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { padding: 16, paddingBottom: 40, maxWidth: 640, width: '100%', alignSelf: 'center' },
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
