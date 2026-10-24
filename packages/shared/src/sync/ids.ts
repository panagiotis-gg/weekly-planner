import { v5 as uuidv5, v7 as uuidv7 } from 'uuid';
import { IsoDate } from '../dates';

/**
 * Row IDs are generated on the client so rows can be created offline (architecture §5.1).
 * React Native needs a `crypto.getRandomValues` polyfill (react-native-get-random-values) for v7.
 */
export function newId(): string {
  return uuidv7();
}

/** Fixed namespace for deterministic IDs. Never change it: existing rows depend on it. */
export const DETERMINISTIC_ID_NAMESPACE = '5b0c3f3e-8f8e-4c71-9d39-2f1e6f7a9c41';

function deterministic(kind: string, ...parts: string[]): string {
  return uuidv5([kind, ...parts].join('|'), DETERMINISTIC_ID_NAMESPACE);
}

// Rows unique per key get deterministic IDs, so two offline devices converge on one row.
export const dayEntryId = (plannerId: string, date: IsoDate) => deterministic('day_entry', plannerId, date);
export const weekNoteId = (plannerId: string, weekKey: IsoDate) => deterministic('week_note', plannerId, weekKey);
export const habitScheduleId = (habitId: string, effectiveFrom: IsoDate) =>
  deterministic('habit_schedule', habitId, effectiveFrom);
export const eventExceptionId = (eventId: string, originalDate: IsoDate) =>
  deterministic('event_exception', eventId, originalDate);
