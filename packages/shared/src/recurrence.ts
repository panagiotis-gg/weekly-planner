import {
  addDays,
  daysInMonth,
  IsoDate,
  isoWeekday,
  makeDate,
  maskIncludes,
  MON_TO_FRI_MASK,
  yearMonthDay,
} from './dates';

/** Basic presets (DECISIONS A6). */
export const RECURRENCE_FREQS = ['daily', 'weekdays', 'weekly', 'monthly', 'yearly', 'month_end', 'first_weekend'] as const;
export type RecurrenceFreq = (typeof RECURRENCE_FREQS)[number];

/** Every N months, on a day worked out per month (DECISIONS A13). */
export const RECURRENCE_LIMITS = {
  intervalMonths: { min: 1, max: 12 },
  daysBeforeMonthEnd: { min: 0, max: 27 },
} as const;
export const isMonthRule = (freq: RecurrenceFreq | null): boolean => freq === 'month_end' || freq === 'first_weekend';

export interface EventLike {
  id: string;
  title: string;
  startDate: IsoDate;
  allDay: boolean;
  startTime: string | null;
  endTime: string | null;
  recurrenceFreq: RecurrenceFreq | null;
  /** Weekday bitmask, `weekly` only. */
  recurrenceWeekdays: number | null;
  recurrenceUntil: IsoDate | null;
  recurrenceCount: number | null;
  /** `month_end` and `first_weekend`: every N months. */
  recurrenceIntervalMonths?: number | null;
  /** `month_end`: calendar days back from the month's last day (0 = the last day). */
  recurrenceDaysBeforeEnd?: number | null;
  /** `first_weekend`: ISO weekday, 6 = Saturday, 7 = Sunday. */
  recurrenceWeekendDay?: number | null;
}

export interface EventExceptionLike {
  eventId: string;
  originalDate: IsoDate;
  cancelled: boolean;
  title: string | null;
  date: IsoDate | null;
  allDay: boolean | null;
  startTime: string | null;
  endTime: string | null;
}

export interface Occurrence {
  eventId: string;
  /** The series date this occurrence stands for (key for "edit this occurrence"). */
  originalDate: IsoDate;
  date: IsoDate;
  title: string;
  allDay: boolean;
  startTime: string | null;
  endTime: string | null;
  isRecurring: boolean;
  /** True when the occurrence was edited individually. */
  isException: boolean;
}

/** Whether a candidate date matches the rule, ignoring until/count. */
function matchesDayRule(event: EventLike, date: IsoDate): boolean {
  switch (event.recurrenceFreq) {
    case 'daily':
      return true;
    case 'weekdays':
      return maskIncludes(MON_TO_FRI_MASK, isoWeekday(date));
    case 'weekly':
      return maskIncludes(event.recurrenceWeekdays ?? 0, isoWeekday(date));
    default:
      return false;
  }
}

/** A month rule's date in one month; null if the rule is incomplete. */
function monthRuleDate(event: EventLike, year: number, month: number): IsoDate | null {
  if (event.recurrenceFreq === 'month_end') {
    if (event.recurrenceDaysBeforeEnd == null) return null;
    return makeDate(year, month, daysInMonth(year, month) - event.recurrenceDaysBeforeEnd);
  }
  if (event.recurrenceWeekendDay == null) return null;
  // The first Saturday's Sunday is always in the same month, so this is the first full weekend.
  const first = makeDate(year, month, 1);
  const saturday = addDays(first, (6 - isoWeekday(first) + 7) % 7);
  return event.recurrenceWeekendDay === 7 ? addDays(saturday, 1) : saturday;
}

/**
 * Candidate dates in ascending order, from the series start, before until/count are applied.
 * Monthly repeats on the start date's day of month and yearly on its month and day; months or
 * years that lack that day are skipped (RFC 5545 behaviour, DECISIONS Q7).
 * For weekly and weekdays rules, dates ≥ startDate that match the rule are occurrences.
 */
function* candidates(event: EventLike): Generator<IsoDate> {
  const freq = event.recurrenceFreq;
  if (freq === null) {
    yield event.startDate;
    return;
  }
  // A weekly rule without days would never yield; treat it as having no occurrences.
  if (freq === 'weekly' && !event.recurrenceWeekdays) return;
  const start = yearMonthDay(event.startDate);
  if (isMonthRule(freq)) {
    const at = (index: number) => monthRuleDate(event, Math.floor(index / 12), (index % 12) + 1);
    const base = start.year * 12 + start.month - 1;
    const firstDate = at(base);
    if (firstDate === null) return;
    // The first occurrence is on or after the start date; the interval counts from it.
    const first = firstDate >= event.startDate ? base : base + 1;
    const step = event.recurrenceIntervalMonths ?? 1;
    for (let i = 0; ; i++) yield at(first + i * step)!;
  }
  if (freq === 'monthly') {
    for (let i = 0; ; i++) {
      const monthIndex = start.month - 1 + i;
      const year = start.year + Math.floor(monthIndex / 12);
      const month = (monthIndex % 12) + 1;
      if (start.day <= daysInMonth(year, month)) yield makeDate(year, month, start.day);
    }
  }
  if (freq === 'yearly') {
    for (let year = start.year; ; year++) {
      if (start.day <= daysInMonth(year, start.month)) yield makeDate(year, start.month, start.day);
    }
  }
  for (let date = event.startDate; ; date = addDays(date, 1)) {
    if (matchesDayRule(event, date)) yield date;
  }
}

/** All occurrence dates of the series in ascending order (infinite if the rule has no end). */
export function* occurrenceDateIterator(event: EventLike): Generator<IsoDate> {
  let emitted = 0;
  for (const date of candidates(event)) {
    if (event.recurrenceUntil !== null && date > event.recurrenceUntil) return;
    if (event.recurrenceCount !== null && emitted >= event.recurrenceCount) return;
    emitted++;
    yield date;
  }
}

/** Occurrence dates within [from, to], inclusive. */
export function occurrenceDates(event: EventLike, from: IsoDate, to: IsoDate): IsoDate[] {
  const out: IsoDate[] = [];
  for (const date of occurrenceDateIterator(event)) {
    if (date > to) break;
    if (date >= from) out.push(date);
  }
  return out;
}

export function isOccurrenceDate(event: EventLike, date: IsoDate): boolean {
  for (const d of occurrenceDateIterator(event)) {
    if (d === date) return true;
    if (d > date) return false;
  }
  return false;
}

/**
 * Occurrences of one event within [from, to], with per-occurrence exceptions applied.
 * Exceptions replace the occurrence with their snapshot (which may move it to another date,
 * including into or out of the range) or cancel it. Exceptions only apply to recurring events.
 * Callers pass live (non-deleted) rows.
 */
export function expandEvent(
  event: EventLike,
  exceptions: readonly EventExceptionLike[],
  from: IsoDate,
  to: IsoDate,
): Occurrence[] {
  const isRecurring = event.recurrenceFreq !== null;
  const byOriginal = new Map<IsoDate, EventExceptionLike>();
  if (isRecurring) {
    for (const ex of exceptions) if (ex.eventId === event.id) byOriginal.set(ex.originalDate, ex);
  }

  const out: Occurrence[] = [];
  for (const date of occurrenceDates(event, from, to)) {
    if (byOriginal.has(date)) continue; // handled below (cancelled or replaced)
    out.push({
      eventId: event.id,
      originalDate: date,
      date,
      title: event.title,
      allDay: event.allDay,
      startTime: event.startTime,
      endTime: event.endTime,
      isRecurring,
      isException: false,
    });
  }

  for (const ex of byOriginal.values()) {
    if (ex.cancelled || ex.date === null || ex.title === null || ex.allDay === null) continue;
    if (ex.date < from || ex.date > to) continue;
    if (!isOccurrenceDate(event, ex.originalDate)) continue; // stale exception after a rule change
    out.push({
      eventId: event.id,
      originalDate: ex.originalDate,
      date: ex.date,
      title: ex.title,
      allDay: ex.allDay,
      startTime: ex.startTime,
      endTime: ex.endTime,
      isRecurring,
      isException: true,
    });
  }
  return out;
}

/** Display order within a day: all-day first, then by start time, then title. */
export function compareOccurrences(a: Occurrence, b: Occurrence): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  const ta = a.startTime ?? '';
  const tb = b.startTime ?? '';
  if (ta !== tb) return ta < tb ? -1 : 1;
  return a.title.localeCompare(b.title);
}

export function expandEvents(
  events: readonly EventLike[],
  exceptions: readonly EventExceptionLike[],
  from: IsoDate,
  to: IsoDate,
): Occurrence[] {
  return events.flatMap((e) => expandEvent(e, exceptions, from, to)).sort(compareOccurrences);
}
