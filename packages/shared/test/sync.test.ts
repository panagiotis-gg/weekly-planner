import {
  compareHlc,
  createHlc,
  dayEntryId,
  formatHlc,
  HlcError,
  mergeFields,
  MergeError,
  newId,
  parseHlc,
  receive,
  tick,
  VersionedRow,
} from '../src';

describe('HLC', () => {
  it('formats stamps that sort in time order', () => {
    expect(formatHlc(1729771200000, 1, 'devA')).toBe('1729771200000:0001:devA');
    expect(compareHlc(formatHlc(999, 0, 'a'), formatHlc(1000, 0, 'a'))).toBe(-1);
    expect(parseHlc('1729771200000:00ff:devA')).toEqual({ ms: 1729771200000, counter: 255, nodeId: 'devA' });
  });

  it('stays monotonic when the wall clock goes backwards', () => {
    let s = createHlc('devA');
    const stamps: string[] = [];
    for (const now of [1000, 2000, 1500, 1500, 3000]) {
      const [next, stamp] = tick(s, now);
      s = next;
      stamps.push(stamp);
    }
    expect([...stamps].sort()).toEqual(stamps);
    expect(new Set(stamps).size).toBe(stamps.length);
  });

  it('orders local events after received remote ones', () => {
    const local = createHlc('devA');
    const remote = formatHlc(5000, 7, 'devB');
    const merged = receive(local, remote, 1000);
    const [, stamp] = tick(merged, 1000);
    expect(compareHlc(stamp, remote)).toBe(1);
  });

  it('rejects remote stamps too far in the future and invalid node ids', () => {
    expect(() => receive(createHlc('a'), formatHlc(10_000_000_000, 0, 'b'), 0)).toThrow(HlcError);
    expect(() => createHlc('bad:id')).toThrow(HlcError);
  });
});

describe('per-field merge', () => {
  type TaskRow = { title: string; done: boolean; deleted: boolean };
  const base: VersionedRow<TaskRow> = {
    row: { title: 'pay phone bill', done: false, deleted: false },
    clocks: { title: 'T1', done: 'T1', deleted: 'T1' },
  };

  it('keeps edits to different fields from different devices', () => {
    const a = mergeFields(base, { title: 'pay credit card' }, { title: 'T2' });
    const b = mergeFields(a, { done: true }, { done: 'T3' });
    expect(b.row).toEqual({ title: 'pay credit card', done: true, deleted: false });
  });

  it('lets the later edit win for the same field and reports stale mutations', () => {
    const later = mergeFields(base, { title: 'later' }, { title: 'T5' });
    const earlier = mergeFields(later, { title: 'earlier' }, { title: 'T4' });
    expect(earlier.row.title).toBe('later');
    expect(earlier.applied).toEqual([]);
  });

  it('converges regardless of arrival order', () => {
    const m1 = { fields: { title: 'x' }, clocks: { title: 'T2' } };
    const m2 = { fields: { done: true, title: 'y' }, clocks: { done: 'T3', title: 'T4' } };
    const m3 = { fields: { deleted: true }, clocks: { deleted: 'T6' } };
    const orders = [
      [m1, m2, m3],
      [m3, m2, m1],
      [m2, m1, m3],
    ];
    const results = orders.map((order) =>
      order.reduce<VersionedRow<TaskRow>>((acc, m) => mergeFields(acc, m.fields, m.clocks), base),
    );
    // `applied` describes only the last step, so compare the converged state.
    for (const r of results) expect({ row: r.row, clocks: r.clocks }).toEqual({ row: results[0]!.row, clocks: results[0]!.clocks });
    expect(results[0]!.row).toEqual({ title: 'y', done: true, deleted: true });
  });

  it('creates a row when none exists and requires a clock per field', () => {
    const created = mergeFields<TaskRow>(null, { title: 'new', done: false, deleted: false }, { title: 'T1', done: 'T1', deleted: 'T1' });
    expect(created.applied).toHaveLength(3);
    expect(() => mergeFields(base, { done: true }, {})).toThrow(MergeError);
  });
});

describe('ids', () => {
  it('generates UUIDv7 ids', () => {
    expect(newId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('generates the same deterministic id on every device', () => {
    const planner = '0192e000-0000-7000-8000-000000000001';
    expect(dayEntryId(planner, '2025-06-09')).toBe(dayEntryId(planner, '2025-06-09'));
    expect(dayEntryId(planner, '2025-06-09')).not.toBe(dayEntryId(planner, '2025-06-10'));
    expect(dayEntryId(planner, '2025-06-09')).toMatch(/^[0-9a-f-]{36}$/);
  });
});
