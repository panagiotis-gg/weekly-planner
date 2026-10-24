import { z } from 'zod';
import { isoWeekday, isValidIsoDate } from '../dates';
import { isValidOrderKey } from '../ordering';
import { HLC_REGEX, NODE_ID_REGEX } from '../sync/hlc';

export const uuidSchema = z.uuid();

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
  .refine(isValidIsoDate, 'Invalid calendar date');

/** Canonical week key: the Monday inside the week. */
export const weekKeySchema = isoDateSchema.refine(
  (d) => !isValidIsoDate(d) || isoWeekday(d) === 1,
  'Week key must be a Monday',
);

/** Wall-clock time, 24h `HH:mm` on the wire. */
export const wallTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:mm');

export const weekdayMaskSchema = z.number().int().min(1).max(127);

export const weekStartDaySchema = z.union([z.literal(1), z.literal(7)]);

export const hlcSchema = z.string().regex(HLC_REGEX, 'Invalid HLC stamp');

export const nodeIdSchema = z.string().regex(NODE_ID_REGEX, 'Invalid node id');

export const positionSchema = z.string().max(100).refine(isValidOrderKey, 'Invalid position key');

export const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Expected #RRGGBB');

/** Required text: trimmed length 1..max. */
export const requiredText = (max: number) =>
  z
    .string()
    .max(max)
    .refine((s) => s.trim().length > 0, 'Must not be empty');

/** Single-line text (no line breaks). */
export const singleLineText = (max: number) =>
  z
    .string()
    .max(max)
    .refine((s) => !/[\r\n]/.test(s), 'Must be a single line');
