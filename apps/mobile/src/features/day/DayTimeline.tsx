import { DAY_MINUTES, IsoDate, layoutTimeline } from '@planner/shared';
import { router } from 'expo-router';
import { ComponentRef, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatTime, todayIso } from '@/lib/format';
import { pressedStyle } from '@/ui/components';
import { usePalette } from '@/ui/theme';

/** Points per hour, and the height of the part of the day shown at once. */
const HOUR = 52;
const VIEW_HEIGHT = 364;
const LABELS = 58;
const px = (minutes: number) => (minutes / 60) * HOUR;
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const pad = (n: number) => String(n).padStart(2, '0');

export interface TimelineItem {
  id: string;
  title: string;
  start: string;
  end: string | null;
  /** Events are filled with the day's colour, tasks outlined; done ones dimmed. */
  kind: 'event' | 'task';
  done: boolean;
  /** Shows ↻ on a repeating event. */
  repeating: boolean;
  onPress: () => void;
}

const nowMinutes = () => {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
};

/**
 * The day's timed events and tasks by hour, like Apple Calendar's day view (DECISIONS L4): a
 * scrollable 24 hours that opens at the current time or the first item, with a line at "now".
 * Tapping an empty hour adds an event at that time.
 */
export function DayTimeline({ date, items, color, canEdit }: { date: IsoDate; items: TimelineItem[]; color: string; canEdit: boolean }) {
  const { t } = useTranslation();
  const p = usePalette();
  const isToday = date === todayIso();
  const [now, setNow] = useState(nowMinutes);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const slots = layoutTimeline(items);
  const firstItem = slots[0]?.top ?? null;

  useEffect(() => {
    if (!isToday) return;
    const timer = setInterval(() => setNow(nowMinutes()), 30_000);
    return () => clearInterval(timer);
  }, [isToday]);

  // Only when the day opens: scrolling must not jump as items change.
  const [openAt] = useState(() => (isToday ? nowMinutes() - 60 : (firstItem ?? 8 * 60) - 30));
  useEffect(() => {
    scroll.current?.scrollTo({ y: Math.max(0, px(openAt)), animated: false });
  }, [openAt]);

  return (
    <ScrollView ref={scroll} style={[styles.view, { borderColor: p.border }]} nestedScrollEnabled showsVerticalScrollIndicator={false}>
      <View style={{ height: px(DAY_MINUTES) }}>
        {HOURS.map((hour) => {
          const time = `${pad(hour)}:00`;
          const label = formatTime(time);
          return (
            <Pressable
              key={hour}
              disabled={!canEdit}
              onPress={() => router.push({ pathname: '/event', params: { date, start: time } })}
              accessibilityRole={canEdit ? 'button' : undefined}
              accessibilityLabel={t('day.addEventAt', { time: label })}
              style={({ pressed }) => [
                styles.hour,
                { borderTopColor: p.border },
                pressed && { backgroundColor: p.surfaceMuted },
              ]}
            >
              <Text style={[styles.hourLabel, { color: p.textMuted }]}>{label}</Text>
            </Pressable>
          );
        })}

        {/* Blocks sit over the hours, in the space right of the labels. */}
        <View pointerEvents="box-none" style={styles.blocks}>
          {slots.map((slot) => {
            const item = items.find((i) => i.id === slot.id)!;
            const event = item.kind === 'event';
            return (
              <Pressable
                key={item.id}
                disabled={!canEdit}
                onPress={item.onPress}
                accessibilityRole="button"
                accessibilityLabel={`${formatTime(item.start)} ${item.title}`}
                style={({ pressed }) => [
                  styles.block,
                  {
                    top: px(slot.top) + 1,
                    height: px(slot.length) - 2,
                    left: `${(slot.column / slot.columns) * 100}%`,
                    width: `${100 / slot.columns}%`,
                    borderColor: color,
                    backgroundColor: event ? color : p.surface,
                  },
                  item.done && styles.done,
                  pressed && pressedStyle,
                ]}
              >
                <Text
                  numberOfLines={slot.length >= 60 ? 2 : 1}
                  style={[styles.blockTitle, { color: event ? p.onDayColor : p.text }, item.done && styles.struck]}
                >
                  {item.title}
                  {item.repeating ? ' ↻' : ''}
                </Text>
                {slot.length >= 45 ? (
                  <Text numberOfLines={1} style={[styles.blockTime, { color: event ? p.onDayColor : p.textMuted }]}>
                    {formatTime(item.start)}
                    {item.end ? ` – ${formatTime(item.end)}` : ''}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {isToday ? (
          <View pointerEvents="none" style={[styles.now, { top: px(now) }]}>
            <View style={[styles.nowDot, { backgroundColor: p.danger }]} />
            <View style={[styles.nowLine, { backgroundColor: p.danger }]} />
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  view: { height: VIEW_HEIGHT, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10 },
  hour: { height: HOUR, borderTopWidth: StyleSheet.hairlineWidth, paddingLeft: 6, paddingTop: 2 },
  hourLabel: { fontSize: 11, width: LABELS - 8, fontVariant: ['tabular-nums'] },
  blocks: { position: 'absolute', top: 0, bottom: 0, left: LABELS, right: 4 },
  block: { position: 'absolute', borderWidth: 1, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, overflow: 'hidden' },
  done: { opacity: 0.5 },
  struck: { textDecorationLine: 'line-through' },
  blockTitle: { fontSize: 13, fontWeight: '600', lineHeight: 16 },
  blockTime: { fontSize: 11, lineHeight: 14 },
  now: { position: 'absolute', left: LABELS - 4, right: 0, height: 8, marginTop: -4, flexDirection: 'row', alignItems: 'center' },
  nowDot: { width: 8, height: 8, borderRadius: 4 },
  nowLine: { flex: 1, height: 2 },
});
