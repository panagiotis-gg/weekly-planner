import { IsoDate, monthGrid, monthsSpanned, WeekRange } from '@planner/shared';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useDayColorFor } from '@/state/planner';
import { formatMonth, formatMonthDay, formatTime, formatWeekday, todayIso, upper } from '@/lib/format';
import { pressedStyle } from '@/ui/components';
import { Palette, usePalette } from '@/ui/theme';
import { CalendarItem, DayOverview, useCalendarOverview } from './useCalendarOverview';

const RING = 24;
const STROKE = 2;
/** Item names per day cell; the rest show as "+N" (the day page has them all). */
const MAX_ITEMS = 3;

/** Task progress ring around the date number; only drawn for days with tasks. */
function ProgressRing({ percent, p, color }: { percent: number; p: Palette; color: string }) {
  const r = (RING - STROKE) / 2;
  const c = 2 * Math.PI * r;
  return (
    <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
      <Circle cx={RING / 2} cy={RING / 2} r={r} stroke={p.border} strokeWidth={STROKE} fill="none" />
      {percent > 0 ? (
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={r}
          stroke={color}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${(c * percent) / 100} ${c}`}
          rotation={-90}
          origin={`${RING / 2}, ${RING / 2}`}
        />
      ) : null}
    </Svg>
  );
}

/** One name in a day cell: events filled with the day's colour, tasks and to-dos outlined. */
function ItemBar({ item, color, p }: { item: CalendarItem; color: string; p: Palette }) {
  const event = item.kind === 'event';
  return (
    <View
      style={[
        styles.bar,
        { borderColor: color, backgroundColor: event ? color : 'transparent' },
        item.done && styles.barDone,
      ]}
    >
      <Text
        numberOfLines={1}
        style={[styles.barText, { color: event ? p.onDayColor : p.text }, item.done && styles.barTextDone]}
      >
        {item.title}
      </Text>
    </View>
  );
}

/**
 * Month calendars for the month(s) the selected week spans, with the week highlighted, as an
 * agenda (DECISIONS A12): each day shows its events, tasks and due to-dos by name, plus the ring
 * of its task progress. Tapping a date opens that day's page (A2).
 */
export function MonthCalendars({ range, plannerId }: { range: WeekRange; plannerId: string }) {
  const { t } = useTranslation();
  const p = usePalette();
  const startDay = range.start === range.weekKey ? 1 : 7;
  const today = todayIso();
  const days = useCalendarOverview(plannerId, range, startDay);
  const colorFor = useDayColorFor();

  const cellLabel = (date: IsoDate, info: DayOverview | undefined) => {
    const parts = [`${formatWeekday(date)} ${formatMonthDay(date)}`];
    if (info && info.tasksTotal > 0) parts.push(t('calendar.a11yTasks', { done: info.tasksDone, total: info.tasksTotal }));
    for (const item of info?.items ?? []) parts.push(item.time ? `${formatTime(item.time)} ${item.title}` : item.title);
    return t('week.openDay', { day: parts.join(', ') });
  };

  return (
    <View style={styles.months}>
      {monthsSpanned(range).map(({ year, month }) => (
        <View key={`${year}-${month}`} style={styles.month}>
          <Text style={[styles.monthTitle, { color: p.text, backgroundColor: p.surfaceMuted }]}>
            {upper(formatMonth(year, month, true))}
          </Text>
          <View style={styles.week}>
            {range.days.map((d) => (
              <Text key={d} style={[styles.cell, styles.head, { color: p.textMuted }]}>
                {formatWeekday(d, 'narrow')}
              </Text>
            ))}
          </View>
          {monthGrid(year, month, startDay).map((row, i) => {
            const isSelectedRow = row.some((d) => d !== null && d >= range.start && d <= range.end);
            return (
              <View
                key={i}
                style={[styles.week, { borderTopColor: p.border }, styles.weekLine, isSelectedRow && { backgroundColor: p.surfaceMuted }]}
              >
                {row.map((date, j) => {
                  if (!date) return <View key={j} style={styles.cell} />;
                  const info = days.get(date);
                  const inWeek = date >= range.start && date <= range.end;
                  const isToday = date === today;
                  const items = info?.items ?? [];
                  const hidden = items.length - MAX_ITEMS;
                  const color = colorFor(date);
                  return (
                    <Pressable
                      key={date}
                      onPress={() => router.push({ pathname: '/day/[date]', params: { date } })}
                      accessibilityRole="button"
                      accessibilityLabel={cellLabel(date, info)}
                      style={({ pressed }) => [styles.cell, pressed && pressedStyle]}
                    >
                      <View style={styles.ringBox}>
                        {info?.taskPercent != null ? <ProgressRing percent={info.taskPercent} p={p} color={color} /> : null}
                        <Text
                          style={{
                            // Today is marked by colour (user request), not by a ring or underline.
                            color: isToday ? p.accent : inWeek ? p.text : p.textMuted,
                            fontSize: 12,
                            fontWeight: isToday ? '800' : inWeek ? '700' : '400',
                          }}
                        >
                          {Number(date.slice(8))}
                        </Text>
                      </View>
                      {items.slice(0, MAX_ITEMS).map((item) => (
                        <ItemBar key={item.id} item={item} color={color} p={p} />
                      ))}
                      {hidden > 0 ? <Text style={[styles.more, { color: p.textMuted }]}>{`+${hidden}`}</Text> : null}
                    </Pressable>
                  );
                })}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  months: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  month: { minWidth: 300, flex: 1, gap: 2 },
  monthTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    textAlign: 'center',
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 4,
    overflow: 'hidden',
  },
  week: { flexDirection: 'row', alignItems: 'stretch' },
  weekLine: { borderTopWidth: StyleSheet.hairlineWidth },
  // minWidth 0 lets long names shorten instead of widening their column. Rows grow with their items.
  cell: { flex: 1, minWidth: 0, minHeight: 48, alignItems: 'center', gap: 2, paddingHorizontal: 1, paddingVertical: 2 },
  head: { minHeight: 20, fontSize: 11, fontWeight: '600', textAlign: 'center', lineHeight: 20 },
  ringBox: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  bar: { alignSelf: 'stretch', borderWidth: 1, borderRadius: 3, paddingHorizontal: 2, overflow: 'hidden' },
  barDone: { opacity: 0.5 },
  barText: { fontSize: 10, lineHeight: 13 },
  barTextDone: { textDecorationLine: 'line-through' },
  more: { fontSize: 10, lineHeight: 13 },
});
