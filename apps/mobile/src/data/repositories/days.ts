import { dayEntryId, DayEntry, IsoDate, WeekNote, weekNoteId } from '@planner/shared';
import { selectRows, writeFields } from '../write';

// ---- Day entry: "today's focus" + day note (one row per planner and date, deterministic id) ----

export function getDayEntry(plannerId: string, date: IsoDate): DayEntry | null {
  return selectRows<DayEntry>('day_entry', plannerId, 'date = ?', [date])[0] ?? null;
}

function writeDayEntry(plannerId: string, date: IsoDate, fields: Partial<DayEntry>): void {
  const id = dayEntryId(plannerId, date);
  const exists = selectRows<DayEntry>('day_entry', plannerId, 'id = ?', [id]).length > 0;
  const base = exists ? {} : { date, focus: null, note: null, deleted: false };
  writeFields('day_entry', id, plannerId, { ...base, ...fields });
}

export const setFocus = (plannerId: string, date: IsoDate, focus: string) =>
  writeDayEntry(plannerId, date, { focus: focus.trim() === '' ? null : focus });

export const setDayNote = (plannerId: string, date: IsoDate, note: string) =>
  writeDayEntry(plannerId, date, { note: note.trim() === '' ? null : note });

// ---- Week note (one row per planner and week key) ----

export function getWeekNote(plannerId: string, weekKey: IsoDate): WeekNote | null {
  return selectRows<WeekNote>('week_note', plannerId, 'week_key = ?', [weekKey])[0] ?? null;
}

export function setWeekNote(plannerId: string, weekKey: IsoDate, body: string): void {
  const id = weekNoteId(plannerId, weekKey);
  const exists = getWeekNote(plannerId, weekKey) !== null;
  const base = exists ? {} : { weekKey, deleted: false };
  writeFields('week_note', id, plannerId, { ...base, body: body.trim() === '' ? null : body });
}
