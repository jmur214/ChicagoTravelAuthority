/**
 * Structural equality for JSON-like values, independent of object key order.
 * Needed because Postgres JSONB returns keys in its own order, so a value read
 * back from the database rarely stringifies the same as the value written.
 * null and undefined are treated as equal ("no value").
 */
export function deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a == null || b == null) return a == null && b == null;
    if (a instanceof Date || b instanceof Date) {
        return new Date(a as Date).getTime() === new Date(b as Date).getTime();
    }
    if (typeof a !== 'object' || typeof b !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a) && Array.isArray(b)) {
        return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
    }
    const ka = Object.keys(a as object).filter(k => (a as Record<string, unknown>)[k] !== undefined);
    const kb = Object.keys(b as object).filter(k => (b as Record<string, unknown>)[k] !== undefined);
    return ka.length === kb.length && ka.every(k => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}
