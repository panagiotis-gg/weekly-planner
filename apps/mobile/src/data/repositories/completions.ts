import { Completion, IsoDate, newId } from '@planner/shared';
import { selectRows, writeFields } from '../write';

/**
 * Completion records: one per tap on a habit, weekly to-do or task for a date (DECISIONS J7).
 * Append-only, so taps made offline on several devices all survive sync.
 * Ids are UUIDv7 (time-ordered), so the latest tap is the greatest id.
 */
export type CompletionItemType = 'habit' | 'weekly_todo' | 'task';

export function getCompletions(plannerId: string, from: IsoDate, to: IsoDate): Completion[] {
  return selectRows<Completion>('completion', plannerId, 'date BETWEEN ? AND ?', [from, to]);
}

export function getItemCompletions(plannerId: string, itemId: string): Completion[] {
  return selectRows<Completion>('completion', plannerId, 'item_id = ?', [itemId], 'id ASC');
}

export function addCompletion(plannerId: string, itemType: CompletionItemType, itemId: string, date: IsoDate): void {
  writeFields('completion', newId(), plannerId, { itemType, itemId, date, deleted: false });
}

/** Undo one tap: removes the latest completion for that item and day ("−1", J6). */
export function removeLatestCompletion(plannerId: string, itemId: string, date: IsoDate): void {
  const latest = selectRows<Completion>('completion', plannerId, 'item_id = ? AND date = ?', [itemId, date], 'id DESC')[0];
  if (latest) writeFields('completion', latest.id, plannerId, { deleted: true });
}

/** Undo the most recent tap on an item, whatever its date (habits and weekly to-dos, J6). */
export function removeLatestItemCompletion(plannerId: string, itemId: string): void {
  const latest = getItemCompletions(plannerId, itemId).at(-1);
  if (latest) writeFields('completion', latest.id, plannerId, { deleted: true });
}

/** Checkbox semantics for once-a-day items: checked = at least one completion that day. */
export function setCheckedForDay(
  plannerId: string,
  itemType: CompletionItemType,
  itemId: string,
  date: IsoDate,
  checked: boolean,
): void {
  const existing = selectRows<Completion>('completion', plannerId, 'item_id = ? AND date = ?', [itemId, date]);
  if (checked && existing.length === 0) addCompletion(plannerId, itemType, itemId, date);
  if (!checked) for (const c of existing) writeFields('completion', c.id, plannerId, { deleted: true });
}

/** Removes an item's completions on dates outside `keep` (used when a task's span changes, J4). */
export function discardCompletionsOutside(plannerId: string, itemId: string, keep: readonly IsoDate[]): void {
  const keepSet = new Set(keep);
  for (const c of getItemCompletions(plannerId, itemId)) {
    if (!keepSet.has(c.date)) writeFields('completion', c.id, plannerId, { deleted: true });
  }
}

/** Counts of an item's completions on dates outside `keep` (to warn before discarding them). */
export function countCompletionsOutside(plannerId: string, itemId: string, keep: readonly IsoDate[]): number {
  const keepSet = new Set(keep);
  return getItemCompletions(plannerId, itemId).filter((c) => !keepSet.has(c.date)).length;
}
