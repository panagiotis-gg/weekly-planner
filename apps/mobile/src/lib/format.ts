import { getCalendars, getLocales } from 'expo-localization';
import { IsoDate, makeDate, yearMonthDay } from '@planner/shared';

// UI strings are English only (F3), so dates use English with the device's region (e.g. en-GR)
// instead of mixing languages. Switch to the active i18n language once more locales exist.
const locale = `en-${getLocales()[0]?.regionCode ?? 'US'}`;
/** 12h/24h follows the device (DECISIONS F3). */
const uses24h = getCalendars()[0]?.uses24hourClock ?? false;

/** IsoDate → Date at UTC midnight, so formatting never shifts the calendar day. */
function utcDate(date: IsoDate): Date {
  const { year, month, day } = yearMonthDay(date);
  return new Date(Date.UTC(year, month - 1, day));
}

const fmt = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...options });

const longDay = fmt({ weekday: 'long' });
const shortDay = fmt({ weekday: 'short' });
const narrowDay = fmt({ weekday: 'narrow' });
const monthDay = fmt({ month: 'short', day: 'numeric' });
const fullDate = fmt({ month: 'short', day: 'numeric', year: 'numeric' });
const monthYear = fmt({ month: 'long', year: 'numeric' });
const monthOnly = fmt({ month: 'long' });

export const formatWeekday = (date: IsoDate, style: 'long' | 'short' | 'narrow' = 'long') =>
  (style === 'long' ? longDay : style === 'short' ? shortDay : narrowDay).format(utcDate(date));
export const formatMonthDay = (date: IsoDate) => monthDay.format(utcDate(date));
export const formatFullDate = (date: IsoDate) => fullDate.format(utcDate(date));
export const formatMonth = (year: number, month: number, withYear = false) =>
  (withYear ? monthYear : monthOnly).format(new Date(Date.UTC(year, month - 1, 1)));

const timeFmt = new Intl.DateTimeFormat(locale, {
  hour: 'numeric',
  minute: '2-digit',
  hourCycle: uses24h ? 'h23' : 'h12',
  timeZone: 'UTC',
});

/** Wall-clock "HH:mm" → device-locale time ("9:30 AM" or "09:30"). */
export function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  return timeFmt.format(new Date(Date.UTC(2000, 0, 1, h, m)));
}

/** Today's date on the device's wall clock. */
export function todayIso(): IsoDate {
  const now = new Date();
  return makeDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}
