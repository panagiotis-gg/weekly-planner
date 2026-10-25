import { addDays, IsoDate } from './dates';

/** At the time, 1 hour before, 1 day before (K2); custom offsets are any other number of minutes. */
export const REMINDER_PRESETS = [0, 60, 1440] as const;

/** Reminders on items without a time count from 09:00 (Q6 for all-day events; K4, K5). */
export const DEFAULT_REMINDER_TIME = '09:00';

/** The push service is given the reminders of the next 30 days (K10). */
export const REMINDER_HORIZON_DAYS = 30;

export type ReminderUnit = 'minutes' | 'hours' | 'days';

const MINUTES: Record<ReminderUnit, number> = { minutes: 1, hours: 60, days: 1440 };

/** Wall-clock date and time, "YYYY-MM-DDTHH:mm" (event times are wall-clock, DECISIONS F). */
export type WallDateTime = string;

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * When a reminder fires: `offsetMinutes` before the item's time on `date`, or before 09:00
 * when it has none. May fall on an earlier day.
 */
export function reminderFireAt(date: IsoDate, time: string | null, offsetMinutes: number): WallDateTime {
  const [hours, minutes] = (time ?? DEFAULT_REMINDER_TIME).split(':').map(Number) as [number, number];
  let total = hours * 60 + minutes - offsetMinutes;
  const dayShift = Math.floor(total / 1440);
  total -= dayShift * 1440;
  return `${addDays(date, dayShift)}T${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/** Minutes → the largest whole unit, for showing and editing a custom offset ("2 hours", "90 minutes"). */
export function splitOffset(offsetMinutes: number): { amount: number; unit: ReminderUnit } {
  if (offsetMinutes > 0 && offsetMinutes % MINUTES.days === 0) return { amount: offsetMinutes / MINUTES.days, unit: 'days' };
  if (offsetMinutes > 0 && offsetMinutes % MINUTES.hours === 0) return { amount: offsetMinutes / MINUTES.hours, unit: 'hours' };
  return { amount: offsetMinutes, unit: 'minutes' };
}

export function joinOffset(amount: number, unit: ReminderUnit): number {
  return amount * MINUTES[unit];
}
