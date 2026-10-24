/** Whole-number percentage (DECISIONS §A "Progress % display"), or null when there is nothing to count. */
export function percent(done: number, total: number): number | null {
  if (total === 0) return null;
  return Math.round((done * 100) / total);
}
