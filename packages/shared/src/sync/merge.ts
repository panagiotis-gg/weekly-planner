/**
 * Per-field last-writer-wins merge (DECISIONS E2, architecture §5.2).
 * Applied identically on the server and on devices, so every replica converges
 * regardless of the order in which mutations arrive.
 */

export type FieldClocks = Record<string, string>;

export interface VersionedRow<T> {
  row: T;
  clocks: FieldClocks;
}

export interface MergeResult<T> extends VersionedRow<T> {
  /** Fields whose incoming value won. Empty means the mutation was stale. */
  applied: string[];
}

export class MergeError extends Error {}

export function mergeFields<T extends Record<string, unknown>>(
  current: VersionedRow<T> | null,
  fields: Partial<T>,
  clocks: FieldClocks,
): MergeResult<T> {
  const row: Record<string, unknown> = { ...(current?.row ?? {}) };
  const nextClocks: FieldClocks = { ...(current?.clocks ?? {}) };
  const applied: string[] = [];

  for (const [field, value] of Object.entries(fields)) {
    const incoming = clocks[field];
    if (incoming === undefined) throw new MergeError(`Missing clock for field "${field}"`);
    const stored = nextClocks[field];
    if (stored === undefined || incoming > stored) {
      row[field] = value;
      nextClocks[field] = incoming;
      applied.push(field);
    }
  }
  return { row: row as T, clocks: nextClocks, applied };
}
