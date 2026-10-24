import {
  EventException,
  eventExceptionId,
  expandEvents,
  IsoDate,
  newId,
  Occurrence,
  PlannerEvent,
  RecurrenceFreq,
} from '@planner/shared';
import { selectRows, writeFields } from '../write';

/** Events with optional end, all-day and basic recurrence presets (DECISIONS A6, Q7, Q8). */

export interface EventDraft {
  title: string;
  startDate: IsoDate;
  allDay: boolean;
  startTime: string | null;
  endTime: string | null;
  recurrenceFreq: RecurrenceFreq | null;
  recurrenceWeekdays: number | null;
  recurrenceUntil: IsoDate | null;
  recurrenceCount: number | null;
}

export function getEvent(plannerId: string, id: string): PlannerEvent | null {
  return selectRows<PlannerEvent>('event', plannerId, 'id = ?', [id])[0] ?? null;
}

export function getOccurrences(plannerId: string, from: IsoDate, to: IsoDate): Occurrence[] {
  const events = selectRows<PlannerEvent>('event', plannerId);
  const exceptions = selectRows<EventException>('event_exception', plannerId);
  return expandEvents(events, exceptions, from, to);
}

export function createEvent(plannerId: string, draft: EventDraft): void {
  writeFields('event', newId(), plannerId, { ...draft, title: draft.title.trim(), deleted: false });
}

/** "All occurrences" (or a one-off event): edit the series row. */
export function updateEvent(event: PlannerEvent, draft: EventDraft): void {
  writeFields('event', event.id, event.plannerId, { ...draft, title: draft.title.trim() });
}

export function deleteEvent(event: PlannerEvent): void {
  writeFields('event', event.id, event.plannerId, { deleted: true });
}

interface OccurrenceEdit {
  title: string;
  date: IsoDate;
  allDay: boolean;
  startTime: string | null;
  endTime: string | null;
}

/** "This occurrence": store a full snapshot replacing it. */
export function editOccurrence(event: PlannerEvent, originalDate: IsoDate, edit: OccurrenceEdit): void {
  writeFields('event_exception', eventExceptionId(event.id, originalDate), event.plannerId, {
    eventId: event.id,
    originalDate,
    cancelled: false,
    ...edit,
    title: edit.title.trim(),
    deleted: false,
  });
}

/** Delete just this occurrence of a recurring event. */
export function cancelOccurrence(event: PlannerEvent, originalDate: IsoDate): void {
  writeFields('event_exception', eventExceptionId(event.id, originalDate), event.plannerId, {
    eventId: event.id,
    originalDate,
    cancelled: true,
    title: null,
    date: null,
    allDay: null,
    startTime: null,
    endTime: null,
    deleted: false,
  });
}
