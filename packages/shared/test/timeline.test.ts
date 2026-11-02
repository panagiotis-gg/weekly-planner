import { layoutTimeline, timeToMinutes } from '../src';

const slot = (id: string, start: string, end: string | null = null) => ({ id, start, end });
const byId = (items: Parameters<typeof layoutTimeline>[0]) => new Map(layoutTimeline(items).map((s) => [s.id, s]));

describe('layoutTimeline (L4)', () => {
  it('places an item by its time, an hour long without an end', () => {
    expect(timeToMinutes('09:30')).toBe(570);
    expect(layoutTimeline([slot('a', '09:30')])).toEqual([{ id: 'a', top: 570, length: 60, column: 0, columns: 1 }]);
    expect(byId([slot('a', '09:00', '09:45')]).get('a')!.length).toBe(45);
  });

  it('keeps separate items at full width, including when one ends as the next starts', () => {
    const s = byId([slot('a', '09:00', '10:00'), slot('b', '10:00', '11:00')]);
    expect(s.get('a')!.columns).toBe(1);
    expect(s.get('b')!.columns).toBe(1);
  });

  it('puts overlapping items side by side', () => {
    const s = byId([slot('a', '09:00', '11:00'), slot('b', '10:00', '12:00')]);
    expect([s.get('a')!.column, s.get('b')!.column]).toEqual([0, 1]);
    expect(s.get('a')!.columns).toBe(2);
    expect(s.get('b')!.columns).toBe(2);
  });

  it('reuses a free column within a group', () => {
    const s = byId([slot('a', '09:00', '12:00'), slot('b', '09:30', '10:00'), slot('c', '10:30', '11:00')]);
    expect(s.get('b')!.column).toBe(1);
    expect(s.get('c')!.column).toBe(1);
    expect(s.get('a')!.columns).toBe(2);
  });

  it('gives very short items room, and stays within the day', () => {
    const s = byId([slot('a', '09:00', '09:05'), slot('b', '09:20', '09:40'), slot('late', '23:30')]);
    expect(s.get('a')!.length).toBe(30);
    expect(s.get('b')!.columns).toBe(2);
    expect(s.get('late')!.length).toBe(30);
  });
});
