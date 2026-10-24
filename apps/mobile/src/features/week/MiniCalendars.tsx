import { HabitWeekRow, IsoDate, monthGrid, monthsSpanned, WeekRange } from '@planner/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { kvGet, kvSet } from '@/data/db/client';
import { formatMonth, formatMonthDay, formatWeekday, todayIso, upper } from '@/lib/format';
import { Palette, usePalette } from '@/ui/theme';
import { DayOverview, useCalendarOverview } from './useCalendarOverview';

/** Remembered on this device: whether the selected week's summary row is expanded. */
const EXPANDED_KEY = 'calendar_week_expanded';
const RING = 30;
const STROKE = 2;

/** Task progress ring around the date number; only drawn for days with tasks. */
function ProgressRing({ percent, p }: { percent: number; p: Palette }) {
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
          stroke={p.accent}
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

/**
 * Mini month calendars for the month(s) the selected week spans, with the week highlighted.
 * Tapping a date opens that day's page (DECISIONS A2). A quiet overview:
 *  1. a ring of each day's task progress and a dot for days with events;
 *  2. one summary line for the selected week;
 *  3. the selected week can expand into a short per-day summary.
 */
export function MiniCalendars({
  range,
  plannerId,
  habitRows,
}: {
  range: WeekRange;
  plannerId: string;
  habitRows: readonly HabitWeekRow[];
}) {
  const { t } = useTranslation();
  const p = usePalette();
  const startDay = range.start === range.weekKey ? 1 : 7;
  const today = todayIso();
  const overview = useCalendarOverview(plannerId, range, habitRows);
  const [expanded, setExpanded] = useState(() => kvGet(EXPANDED_KEY) === '1');
  const toggle = () => {
    kvSet(EXPANDED_KEY, expanded ? '0' : '1');
    setExpanded(!expanded);
  };
  const months = monthsSpanned(range);

  const cellLabel = (date: IsoDate, info: DayOverview | undefined) => {
    const parts = [`${formatWeekday(date)} ${formatMonthDay(date)}`];
    if (info && info.tasksTotal > 0) parts.push(t('calendar.a11yTasks', { done: info.tasksDone, total: info.tasksTotal }));
    if (info?.hasEvents) parts.push(t('calendar.a11yEvents'));
    return t('week.openDay', { day: parts.join(', ') });
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.months}>
        {months.map(({ year, month }, monthIndex) => (
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
              <View style={styles.side} />
            </View>
            {monthGrid(year, month, startDay).map((row, i) => {
              const isSelectedRow = row.some((d) => d !== null && d >= range.start && d <= range.end);
              // The expand control and panel belong to the selected week's row in the first month shown.
              const withControl = isSelectedRow && monthIndex === 0;
              return (
                <View key={i}>
                  <View style={[styles.week, isSelectedRow && { backgroundColor: p.surfaceMuted, borderRadius: 10 }]}>
                    {row.map((date, j) => {
                      if (!date) return <View key={j} style={styles.cell} />;
                      const info = overview.days.get(date);
                      const inWeek = date >= range.start && date <= range.end;
                      const isToday = date === today;
                      return (
                        <Pressable
                          key={date}
                          onPress={() => router.push({ pathname: '/day/[date]', params: { date } })}
                          accessibilityRole="button"
                          accessibilityLabel={cellLabel(date, info)}
                          style={styles.cell}
                        >
                          <View style={styles.ringBox}>
                            {info?.taskPercent != null ? <ProgressRing percent={info.taskPercent} p={p} /> : null}
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
                          <View style={[styles.dot, info?.hasEvents && { backgroundColor: p.accent }]} />
                        </Pressable>
                      );
                    })}
                    <View style={styles.side}>
                      {withControl ? (
                        <Pressable
                          onPress={toggle}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityState={{ expanded }}
                          accessibilityLabel={t(expanded ? 'calendar.collapse' : 'calendar.expand')}
                        >
                          <Text style={{ color: p.textMuted, fontSize: 14 }}>{expanded ? '▴' : '▾'}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                  {withControl && expanded ? <WeekDetails range={range} days={overview.days} p={p} /> : null}
                </View>
              );
            })}
          </View>
        ))}
      </View>
      <Text style={[styles.summary, { color: p.textMuted }]}>{overview.weekSummary}</Text>
    </View>
  );
}

/** Level 3: per day of the selected week — task bar with done/total, first event, habits done/due. */
function WeekDetails({ range, days, p }: { range: WeekRange; days: ReadonlyMap<IsoDate, DayOverview>; p: Palette }) {
  return (
    <View style={[styles.week, styles.details, { backgroundColor: p.surfaceMuted }]}>
      {range.days.map((date) => {
        const info = days.get(date);
        return (
          <View key={date} style={[styles.cell, styles.detailCell]}>
            <View style={[styles.bar, { backgroundColor: p.border }]}>
              <View style={{ width: `${info?.taskPercent ?? 0}%`, height: '100%', backgroundColor: p.accent }} />
            </View>
            <Text style={[styles.detailText, { color: p.textMuted }]}>
              {info && info.tasksTotal > 0 ? `${info.tasksDone}/${info.tasksTotal}` : '–'}
            </Text>
            <Text style={[styles.detailText, { color: p.textMuted }]} numberOfLines={1}>
              {info?.firstEvent ?? ' '}
            </Text>
            <Text style={[styles.detailText, { color: p.textMuted }]}>
              {info && info.habitsDue > 0 ? `${info.habitsDone}/${info.habitsDue} ↻` : ' '}
            </Text>
          </View>
        );
      })}
      <View style={styles.side} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  months: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  month: { minWidth: 230, flex: 1, gap: 2 },
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
  week: { flexDirection: 'row', alignItems: 'center' },
  cell: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center' },
  head: { height: 20, fontSize: 11, fontWeight: '600', textAlign: 'center', lineHeight: 20 },
  side: { width: 22, alignItems: 'center', justifyContent: 'center' },
  ringBox: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 1 },
  details: { borderBottomLeftRadius: 10, borderBottomRightRadius: 10, marginTop: -4, paddingTop: 6, paddingBottom: 6, alignItems: 'flex-start' },
  detailCell: { height: 'auto', paddingHorizontal: 2, gap: 1 },
  bar: { height: 3, borderRadius: 2, width: '80%', overflow: 'hidden', marginBottom: 2 },
  detailText: { fontSize: 10, textAlign: 'center', fontVariant: ['tabular-nums'] },
  summary: { fontSize: 12, textAlign: 'center' },
});
