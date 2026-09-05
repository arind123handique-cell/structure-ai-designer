/**
 * Pure Firestore value sanitizers.
 *
 * Firestore does NOT support nested arrays (an array cannot contain another
 * array as one of its elements). Because this app serializes Maps as arrays of
 * `[key, value]` pairs and mixes primitives/objects/arrays, we recursively
 * convert any array that DIRECTLY contains another array into an object keyed
 * by numeric-string indices, and restore it back afterwards.
 *
 * These functions are kept free of any Firebase import so they can be unit
 * tested in isolation.
 */
export function sanitizeForFirestore(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    const hasNested = value.some((el) => Array.isArray(el));
    if (hasNested) {
      const obj: Record<string, unknown> = {};
      for (let i = 0; i < value.length; i++) {
        obj[String(i)] = sanitizeForFirestore(value[i]);
      }
      return obj;
    }
    return value.map(sanitizeForFirestore).filter((v) => v !== undefined);
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue; // Firestore rejects undefined field values
      out[k] = sanitizeForFirestore(v);
    }
    return out;
  }
  return value;
}

/** Reverse the sanitization: convert object-with-numeric-keys back to arrays. */
export function restoreFromFirestore(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map(restoreFromFirestore);
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length > 0 && keys.every((k) => /^\d+$/.test(k))) {
      const maxIdx = Math.max(...keys.map(Number));
      const arr: unknown[] = new Array(maxIdx + 1);
      for (const k of keys) {
        arr[Number(k)] = restoreFromFirestore(obj[k]);
      }
      return arr;
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = restoreFromFirestore(v);
    }
    return out;
  }
  return value;
}
