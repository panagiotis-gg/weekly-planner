import { addDays, diffDays, IsoDate, isValidIsoDate, weekKeyOf, weekRange } from '@planner/shared';
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, FlatListProps, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { DayColumn } from '@/features/day/DayColumn';
import { formatWeekday, todayIso } from '@/lib/format';
import { usePlanner, PlannerGate } from '@/state/planner';
import { IconButton } from '@/ui/components';
import { usePalette } from '@/ui/theme';

/** Days reachable by swiping from the opened date, in each direction. */
const SPAN = 366;

type ViewableChange = Parameters<NonNullable<FlatListProps<IsoDate>['onViewableItemsChanged']>>[0];

function DayScreenContent() {
  const { date } = useLocalSearchParams<{ date: string }>();
  if (!date || !isValidIsoDate(date)) return <Redirect href={{ pathname: '/day/[date]', params: { date: todayIso() } }} />;
  return <DayPager initialDate={date} />;
}

/** Swipe day to day (DECISIONS F2), crossing week boundaries; arrows for mouse and keyboard users. */
function DayPager({ initialDate }: { initialDate: IsoDate }) {
  const { t } = useTranslation();
  const p = usePalette();
  const planner = usePlanner();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<IsoDate>>(null);
  // The list is anchored on the date it was opened with; the URL follows the visible page.
  const [anchor] = useState(initialDate);
  const days = useMemo(() => Array.from({ length: SPAN * 2 + 1 }, (_, i) => addDays(anchor, i - SPAN)), [anchor]);
  const [current, setCurrent] = useState(initialDate);

  // FlatList requires onViewableItemsChanged to keep the same identity for its lifetime.
  const [onViewable] = useState(() => ({ viewableItems }: ViewableChange) => {
    const visible = viewableItems[0]?.item;
    if (visible) {
      setCurrent(visible);
      router.setParams({ date: visible });
    }
  });

  const go = useCallback(
    (step: number) => {
      const index = SPAN + diffDays(current, anchor) + step;
      if (index >= 0 && index < days.length) listRef.current?.scrollToIndex({ index, animated: true });
    },
    [current, anchor, days.length],
  );

  const weekKey = weekKeyOf(current, planner.weekStartDay);

  return (
    <View style={styles.flex}>
      <Stack.Screen
        options={{
          title: formatWeekday(current),
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
              <IconButton glyph="‹" size={24} label={t('common.previous')} onPress={() => go(-1)} />
              <IconButton glyph="›" size={24} label={t('common.next')} onPress={() => go(1)} />
            </View>
          ),
        }}
      />
      <FlatList
        ref={listRef}
        data={days}
        keyExtractor={(d) => d}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={SPAN}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        windowSize={3}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        onViewableItemsChanged={onViewable}
        renderItem={({ item }) => (
          <ScrollView style={{ width }} contentContainerStyle={styles.page}>
            <DayColumn date={item} range={weekRange(weekKeyOf(item, planner.weekStartDay), planner.weekStartDay)} />
          </ScrollView>
        )}
      />
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
