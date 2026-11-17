import { describe, expect, it } from 'vitest';
import { formatTimeInZone, toZonedWallTime, zonedWallTimeToDate } from './time';

describe('zonedWallTimeToDate', () => {
    it('interprets wall time as Chicago time in winter (CST, UTC-6)', () => {
        expect(zonedWallTimeToDate('2026-11-17T20:00').toISOString()).toBe('2026-11-18T02:00:00.000Z');
    });

    it('interprets wall time as Chicago time in summer (CDT, UTC-5)', () => {
        expect(zonedWallTimeToDate('2026-07-15T12:30').toISOString()).toBe('2026-07-15T17:30:00.000Z');
    });

    it('handles the evening of a DST change', () => {
        // 2026-03-08 is spring-forward day; 21:00 is already CDT.
        expect(zonedWallTimeToDate('2026-03-08T21:00').toISOString()).toBe('2026-03-09T02:00:00.000Z');
    });

    it('rejects malformed input', () => {
        expect(() => zonedWallTimeToDate('tonight')).toThrow();
    });
});

describe('toZonedWallTime / formatTimeInZone', () => {
    it('round-trips', () => {
        const value = '2026-11-17T20:15';
        expect(toZonedWallTime(zonedWallTimeToDate(value))).toBe(value);
    });

    it('formats in Chicago time', () => {
        expect(formatTimeInZone('2026-11-18T02:00:00.000Z')).toBe('8:00 PM');
    });
});
