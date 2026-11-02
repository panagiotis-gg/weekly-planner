import { ReactNode, useEffect, useState } from 'react';
import { Animated, PanResponder, Platform, StyleSheet, Text, View } from 'react-native';
import { create } from 'zustand';
import { animate } from './motion';
import { usePalette } from './theme';

/**
 * Swipes and long-press drags (DECISIONS L2). Swipes only claim clearly horizontal movement, so
 * vertical scrolling keeps working; a drag starts only after a long-press, and then blocks
 * scrolling until the finger lifts.
 */

/** Horizontal distance (px) a swipe must travel to count. */
const SWIPE_DISTANCE = 60;
const ROW_SWIPE_DISTANCE = 80;

const isHorizontal = (dx: number, dy: number, min: number) => Math.abs(dx) > min && Math.abs(dx) > Math.abs(dy) * 2;

// ---- drag state ----

export interface DragState {
  title: string;
  listId: string;
  fromIndex: number;
  x: number | null;
  y: number | null;
  /** Row under the finger, and day chip under the finger (tasks only). */
  overIndex: number | null;
  overDate: string | null;
  /** Days offered as drop targets, with their labels. */
  dates: { date: string; label: string }[];
}

export const useDragStore = create<{ drag: DragState | null }>(() => ({ drag: null }));

const isDragging = () => useDragStore.getState().drag !== null;

/** Marks a view as a drop target; the web turns these into data-drop-* attributes. */
export const dropRow = (listId: string, index: number) => ({ dataSet: { dropList: listId, dropIndex: String(index) } }) as object;
const dropDay = (date: string) => ({ dataSet: { dropDate: date } }) as object;

/**
 * Starts a drag from a long-press. The finger is followed through document listeners because the
 * browser would otherwise take over the touch to scroll. Web only, for now the only shipped build.
 */
export function startDrag(
  start: Pick<DragState, 'title' | 'listId' | 'fromIndex' | 'dates'>,
  onDrop: (target: { index: number | null; date: string | null }) => void,
): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  useDragStore.setState({ drag: { ...start, x: null, y: null, overIndex: null, overDate: null } });

  const move = (x: number, y: number) => {
    let overIndex: number | null = null;
    let overDate: string | null = null;
    for (const el of document.elementsFromPoint(x, y)) {
      const day = el.closest<HTMLElement>('[data-drop-date]');
      if (day) {
        overDate = day.dataset.dropDate ?? null;
        break;
      }
      const row = el.closest<HTMLElement>('[data-drop-index]');
      if (row && row.dataset.dropList === start.listId) {
        overIndex = Number(row.dataset.dropIndex);
        break;
      }
    }
    useDragStore.setState((s) => (s.drag ? { drag: { ...s.drag, x, y, overIndex, overDate } } : s));
  };
  const onTouchMove = (e: TouchEvent) => {
    e.preventDefault(); // keeps the page still while dragging
    const touch = e.touches[0];
    if (touch) move(touch.clientX, touch.clientY);
  };
  const onMouseMove = (e: MouseEvent) => move(e.clientX, e.clientY);
  const finish = (drop: boolean) => {
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', onEnd);
    document.removeEventListener('touchcancel', onCancel);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onEnd);
    const drag = useDragStore.getState().drag;
    useDragStore.setState({ drag: null });
    if (drop && drag && (drag.overDate !== null || drag.overIndex !== null)) {
      onDrop({ index: drag.overIndex, date: drag.overDate });
    }
  };
  const onEnd = () => finish(true);
  const onCancel = () => finish(false);
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', onEnd);
  document.addEventListener('touchcancel', onCancel);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onEnd);
}

/** What follows the finger, and the days to drop a task on. Mounted once, above every screen. */
export function DragLayer() {
  const p = usePalette();
  const drag = useDragStore((s) => s.drag);
  if (!drag) return null;
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {drag.dates.length > 0 ? (
        <View style={[styles.days, { backgroundColor: p.surface, borderColor: p.border }]}>
          {drag.dates.map(({ date, label }) => {
            const over = drag.overDate === date;
            return (
              <View
                key={date}
                {...dropDay(date)}
                style={[styles.day, { borderColor: over ? p.accent : p.border, backgroundColor: over ? p.accent : 'transparent' }]}
              >
                <Text style={{ color: over ? p.onAccent : p.text, fontSize: 13 }}>{label}</Text>
              </View>
            );
          })}
        </View>
      ) : null}
      {drag.x !== null && drag.y !== null ? (
        <View pointerEvents="none" style={[styles.ghost, { left: drag.x + 12, top: drag.y - 36, backgroundColor: p.text }]}>
          <Text numberOfLines={1} style={{ color: p.background, fontSize: 15 }}>
            {drag.title}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// ---- swipes ----

/** Holds the latest callbacks for a gesture handler that is created once and outlives renders. */
function latestBox<T>(initial: T) {
  let value = initial;
  return {
    get: () => value,
    set: (next: T) => {
      value = next;
    },
  };
}

/** Swipe left or right anywhere in a view, to move to the next or previous page. */
export function usePageSwipe(onStep: (step: 1 | -1) => void) {
  // Created once: a gesture must survive re-renders.
  const [{ latest, handlers }] = useState(() => {
    const latest = latestBox(onStep);
    const handlers = PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => !isDragging() && isHorizontal(g.dx, g.dy, 24),
      // Keeps the gesture, so a month swipe on the calendar isn't taken over by the week swipe around it.
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_, g) => {
        if (g.dx <= -SWIPE_DISTANCE) latest.get()(1);
        else if (g.dx >= SWIPE_DISTANCE) latest.get()(-1);
      },
    }).panHandlers;
    return { latest, handlers };
  });
  useEffect(() => {
    latest.set(onStep);
  });
  return handlers;
}

/** A row that follows the finger sideways: right to complete, left to delete (L2). */
export function SwipeRow({
  children,
  onSwipeRight,
  onSwipeLeft,
}: {
  children: ReactNode;
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
}) {
  const p = usePalette();
  // Created once: a gesture must survive re-renders.
  const [{ offset, latest, handlers }] = useState(() => {
    const offset = new Animated.Value(0);
    const latest = latestBox({ onSwipeRight, onSwipeLeft });
    const settle = () => animate(offset, 0, 160).start();
    const handlers = PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        !isDragging() && isHorizontal(g.dx, g.dy, 12) && (g.dx > 0 ? !!latest.get().onSwipeRight : !!latest.get().onSwipeLeft),
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        // Stays put in a direction with no action.
        const allowed = g.dx > 0 ? !!latest.get().onSwipeRight : !!latest.get().onSwipeLeft;
        offset.setValue(allowed ? g.dx : 0);
      },
      onPanResponderRelease: (_, g) => {
        settle();
        if (g.dx >= ROW_SWIPE_DISTANCE) latest.get().onSwipeRight?.();
        else if (g.dx <= -ROW_SWIPE_DISTANCE) latest.get().onSwipeLeft?.();
      },
      onPanResponderTerminate: settle,
    }).panHandlers;
    return { offset, latest, handlers };
  });
  useEffect(() => {
    latest.set({ onSwipeRight, onSwipeLeft });
  });
  const reveal = (from: number, to: number) => offset.interpolate({ inputRange: [from, to], outputRange: [0, 1], extrapolate: 'clamp' });
  return (
    <View style={styles.swipeWrap}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.under, styles.underLeft, { backgroundColor: p.accent, opacity: reveal(0, 40) }]}>
        <Text style={[styles.underIcon, { color: p.onAccent }]}>✓</Text>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.under, styles.underRight, { backgroundColor: p.danger, opacity: offset.interpolate({ inputRange: [-40, 0], outputRange: [1, 0], extrapolate: 'clamp' }) }]}>
        <Text style={[styles.underIcon, { color: p.onAccent }]}>🗑</Text>
      </Animated.View>
      <Animated.View {...handlers} style={[styles.swipeFront, { backgroundColor: p.surface, transform: [{ translateX: offset }] }]}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  swipeWrap: { overflow: 'hidden', borderRadius: 8 },
  // pan-y: the browser keeps vertical scrolling and leaves sideways movement to the row.
  swipeFront: { touchAction: 'pan-y' } as object,
  under: { justifyContent: 'center', paddingHorizontal: 16 },
  underLeft: { alignItems: 'flex-start' },
  underRight: { alignItems: 'flex-end' },
  underIcon: { fontSize: 18, fontWeight: '700' },
  days: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    padding: 8,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
  },
  day: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 12 },
  ghost: { position: 'absolute', maxWidth: 220, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, opacity: 0.92 },
});
