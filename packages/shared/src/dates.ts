/**
 * Calendar-date helpers on ISO `YYYY-MM-DD` strings.
 *
 * All planner dates are wall-clock dates with no time zone (DECISIONS F3), so the
 * arithmetic is done on UTC epoch days and never touches the device time zone.
 */

export type IsoDate = string;
/** ISO weekday: 1 = Monday … 7 = Sunday. */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const DAY_MS = 86_400_000;
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidIsoDate(value: string): boolean {
  const m = ISO_DATE_RE.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

function parts(date: IsoDate): [number, number, number] {
  const m = ISO_DATE_RE.exec(date);
  if (!m || !isValidIsoDate(date)) throw new RangeError(`Invalid ISO date: ${date}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function makeDate(year: number, month: number, day: number): IsoDate {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function toEpochDay(date: IsoDate): number {
  const [y, m, d] = parts(date);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

export function fromEpochDay(epochDay: number): IsoDate {
  const dt = new Date(epochDay * DAY_MS);
  return makeDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromEpochDay(toEpochDay(date) + days);
}

export function diffDays(later: IsoDate, earlier: IsoDate): number {
  return toEpochDay(later) - toEpochDay(earlier);
}

export function isoWeekday(date: IsoDate): IsoWeekday {
  const [y, m, d] = parts(date);
  const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return (((jsDay + 6) % 7) + 1) as IsoWeekday;
}

export function yearMonthDay(date: IsoDate): { year: number; month: number; day: number } {
  const [year, month, day] = parts(date);
  return { year, month, day };
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** Lexicographic order of ISO dates equals chronological order. */
export function compareDates(a: IsoDate, b: IsoDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ---- Weekday bitmask (bit 0 = Monday … bit 6 = Sunday) ----

export const ALL_DAYS_MASK = 0b1111111;
export const MON_TO_FRI_MASK = 0b0011111;

export function weekdayBit(day: IsoWeekday): number {
  return 1 << (day - 1);
}

export function maskIncludes(mask: number, day: IsoWeekday): boolean {
  return (mask & weekdayBit(day)) !== 0;
}

export function maskFromWeekdays(days: readonly IsoWeekday[]): number {
  return days.reduce((mask, d) => mask | weekdayBit(d), 0);
}

export function weekdaysFromMask(mask: number): IsoWeekday[] {
  const out: IsoWeekday[] = [];
  for (let d = 1; d <= 7; d++) if (maskIncludes(mask, d as IsoWeekday)) out.push(d as IsoWeekday);
  return out;
}
