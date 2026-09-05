import { describe, it, expect } from 'vitest';
import { sanitizeForFirestore, restoreFromFirestore } from '@/lib/firebase/firestoreSanitize';

// Firestore rejects nested arrays (an array cannot contain another array).
// Recursively assert no array directly contains another array.
function assertNoNestedArrays(value: unknown, path = 'root'): void {
  if (Array.isArray(value)) {
    for (const el of value) {
      expect(Array.isArray(el), `nested array found under ${path}`).toBe(false);
      assertNoNestedArrays(el, `${path}/[]`);
    }
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      assertNoNestedArrays(v, `${path}/${k}`);
    }
  }
}

describe('sanitizeForFirestore (nested-array handling)', () => {
  it('converts an array whose nested array is NOT at index 0', () => {
    // The exact bug: value[0] is a primitive, but a later element is an array.
    const input = [1, 2, [3, 4]];
    const out = sanitizeForFirestore(input);
    assertNoNestedArrays(out);
    expect(out).toEqual({ '0': 1, '1': 2, '2': [3, 4] });
    // round-trip
    expect(restoreFromFirestore(out)).toEqual(input);
  });

  it('converts serialized Map entries [[k,v], ...] when key is not an array', () => {
    const input = [[3, { a: 1 }], [5, { b: [1, 2, 3] }]];
    const out = sanitizeForFirestore(input);
    assertNoNestedArrays(out);
    expect(out).toEqual({ '0': [3, { a: 1 }], '1': [5, { b: [1, 2, 3] }] });
    expect(restoreFromFirestore(out)).toEqual(input);
  });

  it('keeps flat arrays of objects containing array fields (valid Firestore shape)', () => {
    const input = [{ id: 1, vals: [10, 20] }, { id: 2, vals: [30, 40] }];
    const out = sanitizeForFirestore(input);
    assertNoNestedArrays(out);
    // flat array of maps is kept as an array
    expect(Array.isArray(out)).toBe(true);
    expect(restoreFromFirestore(out)).toEqual(input);
  });

  it('keeps flat arrays of primitives', () => {
    const input = [1, 2.5, 'x', true];
    expect(sanitizeForFirestore(input)).toEqual(input);
  });

  it('deeply nested structure round-trips through restore', () => {
    const input = {
      nodes: [[1, { x: 0, y: 0 }], [2, { x: 3, y: 4 }]],
      groups: [['a', 'b'], ['c']],
      tags: ['flat', 'list'],
      point: { arr: [1, 2] },
    };
    const out = sanitizeForFirestore(input);
    assertNoNestedArrays(out);
    expect(restoreFromFirestore(out)).toEqual(input);
  });

  it('drops undefined values at the object level (Firestore rejects undefined)', () => {
    const out = sanitizeForFirestore({ a: 1, b: undefined, c: null });
    expect(out).toEqual({ a: 1, c: null });
  });
});
