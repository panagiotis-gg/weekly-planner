import { newId, Reminder, ReminderItemType } from '@planner/shared';
import { kvGet, kvSet } from '../db/client';
import { selectRows, writeFields } from '../write';

/**
 * Reminders on events, tasks, habits and weekly to-dos (DECISIONS K1–K2): each is an offset in
 * minutes before the item's time (or 09:00). Reminders are personal (Q5): only the current
 * user's rows are read or written.
 */

const LOCAL_USER_KEY = 'localUserId';

/** Until sign-in exists, the user id of this install (stable, stored with the planner). */
export function localUserId(): string {
  let id = kvGet(LOCAL_USER_KEY);
  if (!id) {
    id = newId();
    kvSet(LOCAL_USER_KEY, id);
  }
  return id;
}

export function getMyReminders(plannerId: string): Reminder[] {
  return selectRows<Reminder>('reminder', plannerId, 'user_id = ?', [localUserId()]);
}

/** The current user's offsets on one item, ascending. */
export function getItemOffsets(plannerId: string, itemId: string): number[] {
  const rows = selectRows<Reminder>('reminder', plannerId, 'item_id = ? AND user_id = ?', [itemId, localUserId()]);
  return [...new Set(rows.map((r) => r.offsetMinutes))].sort((a, b) => a - b);
}

/** Make the item's reminders exactly `offsets`: removes the others, adds the missing ones. */
export function setItemReminders(plannerId: string, itemType: ReminderItemType, itemId: string, offsets: number[]): void {
  const userId = localUserId();
  const existing = selectRows<Reminder>('reminder', plannerId, 'item_id = ? AND user_id = ?', [itemId, userId]);
  const wanted = new Set(offsets);
  const kept = new Set<number>();
  for (const row of existing) {
    if (wanted.has(row.offsetMinutes) && !kept.has(row.offsetMinutes)) kept.add(row.offsetMinutes);
    else writeFields('reminder', row.id, plannerId, { deleted: true });
  }
  for (const offsetMinutes of wanted) {
    if (kept.has(offsetMinutes)) continue;
    writeFields('reminder', newId(), plannerId, { itemType, itemId, userId, offsetMinutes, deleted: false });
  }
}
