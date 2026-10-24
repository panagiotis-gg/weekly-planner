import {
  addDays,
  daysInMonth,
  IsoDate,
  isoWeekday,
  makeDate,
  yearMonthDay,
} from './dates';

/** Planner setting (DECISIONS A1): ISO 1 = Monday, 7 = Sunday. */
export type WeekStartDay = 1 | 7;

export interface WeekRange {
  /** Canonical key: the Monday inside the week (architecture §5.3). */
  weekKey: IsoDate;
  start: IsoDate;
  end: IsoDate;
  /** The seven dates in display order. */
  days: IsoDate[];
}

export function weekStartOf(date: IsoDate, startDay: WeekStartDay): IsoDate {
  const dow = isoWeekday(date);
  const offset = startDay === 1 ? dow - 1 : dow % 7;
  return addDays(date, -offset);
}

/**
 * The Monday that falls inside the displayed week. Unique for both Monday-start and
 * Sunday-start weeks, so weekly items need no migration when a planner switches.
 */
export function weekKeyOf(date: IsoDate, startDay: WeekStartDay): IsoDate {
  const start = weekStartOf(date, startDay);
  return startDay === 1 ? start : addDays(start, 1);
}

export function isWeekKey(date: IsoDate): boolean {
  return isoWeekday(date) === 1;
}

export function weekRange(weekKey: IsoDate, startDay: WeekStartDay): WeekRange {
  if (!isWeekKey(weekKey)) throw new RangeError(`Week key must be a Monday: ${weekKey}`);
  const start = startDay === 1 ? weekKey : addDays(weekKey, -1);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return { weekKey, start, end: days[6]!, days };
}

export function shiftWeek(weekKey: IsoDate, weeks: number): IsoDate {
  return addDays(weekKey, weeks * 7);
}

export interface YearMonth {
  year: number;
  month: number;
}

/** Months shown by the mini calendars: those the week spans (DECISIONS A2), one or two. */
export function monthsSpanned(range: WeekRange): YearMonth[] {
  const a = yearMonthDay(range.start);
  const b = yearMonthDay(range.end);
  const first = { year: a.year, month: a.month };
  if (a.year === b.year && a.month === b.month) return [first];
  return [first, { year: b.year, month: b.month }];
}

/**
 * Month grid for a mini calendar: rows of 7 cells in display order,
 * with `null` for cells outside the month.
 */
export function monthGrid(year: number, month: number, startDay: WeekStartDay): (IsoDate | null)[][] {
  const first = makeDate(year, month, 1);
  const lead = startDay === 1 ? isoWeekday(first) - 1 : isoWeekday(first) % 7;
  const cells: (IsoDate | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= daysInMonth(year, month); d++) cells.push(makeDate(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (IsoDate | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}
