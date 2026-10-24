import { isValidOrderKey, keyBetween, keysBetween, OrderKeyError } from '../src';

describe('fractional ordering keys', () => {
  it('generates keys at the ends and in between', () => {
    expect(keyBetween(null, null)).toBe('a0');
    expect(keyBetween('a0', null)).toBe('a1');
    expect(keyBetween(null, 'a0')).toBe('Zz');
    const mid = keyBetween('a0', 'a1');
    expect('a0' < mid && mid < 'a1').toBe(true);
  });

  it('rejects inverted or invalid bounds', () => {
    expect(() => keyBetween('a1', 'a0')).toThrow(OrderKeyError);
    expect(() => keyBetween('a10', null)).toThrow(OrderKeyError); // trailing zero
    expect(isValidOrderKey('a0')).toBe(true);
    expect(isValidOrderKey('!!')).toBe(false);
  });

  it('generates n sorted keys', () => {
    const keys = keysBetween('a0', 'a1', 10);
    expect(keys).toHaveLength(10);
    expect([...keys].sort()).toEqual(keys);
    expect(keys.every((k) => 'a0' < k && k < 'a1')).toBe(true);
  });

  it('stays sorted under many random insertions (simulated drag reorder)', () => {
    let seed = 42;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed / 2 ** 31;
    };
    const list: string[] = [keyBetween(null, null)];
    for (let i = 0; i < 500; i++) {
      const at = Math.floor(random() * (list.length + 1));
      const key = keyBetween(list[at - 1] ?? null, list[at] ?? null);
      list.splice(at, 0, key);
    }
    expect([...list].sort()).toEqual(list);
    expect(new Set(list).size).toBe(list.length);
    expect(list.every(isValidOrderKey)).toBe(true);
  });
});
