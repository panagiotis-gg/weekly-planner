/** Placing a day's timed items on an hourly timeline (DECISIONS L4). */

export const DAY_MINUTES = 24 * 60;
/** Length of an item without an end time. */
export const DEFAULT_ITEM_MINUTES = 60;
/** Short items still take this much room, so they never sit under each other. */
const MIN_ITEM_MINUTES = 30;

export interface TimelineInput {
  id: string;
  /** "HH:mm" */
  start: string;
  end: string | null;
}

export interface TimelineSlot {
  id: string;
  /** Minutes from midnight. */
  top: number;
  /** Minutes long, staying within the day. */
  length: number;
  /** Side by side when overlapping: this item's column of `columns`. */
  column: number;
  columns: number;
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number) as [number, number];
  return hours * 60 + minutes;
}

/** Items that overlap share the width equally; everything else takes the full width. */
export function layoutTimeline(items: readonly TimelineInput[]): TimelineSlot[] {
  const sorted = items
    .map((item) => {
      const top = timeToMinutes(item.start);
      const end = item.end ? timeToMinutes(item.end) : top + DEFAULT_ITEM_MINUTES;
      const length = Math.max(Math.min(end, DAY_MINUTES) - top, MIN_ITEM_MINUTES);
      return { id: item.id, top, length };
    })
    .sort((a, b) => a.top - b.top || b.length - a.length);

  const slots: TimelineSlot[] = [];
  let cluster: TimelineSlot[] = [];
  let clusterEnd = -1;
  const closeCluster = () => {
    const columns = Math.max(...cluster.map((s) => s.column)) + 1;
    for (const slot of cluster) slot.columns = columns;
    cluster = [];
  };
  for (const item of sorted) {
    if (cluster.length > 0 && item.top >= clusterEnd) closeCluster();
    // The first column whose last item has ended.
    let column = 0;
    while (cluster.some((s) => s.column === column && s.top + s.length > item.top)) column++;
    const slot: TimelineSlot = { ...item, column, columns: 1 };
    cluster.push(slot);
    slots.push(slot);
    clusterEnd = Math.max(clusterEnd, item.top + item.length);
  }
  if (cluster.length > 0) closeCluster();
  return slots;
}
