import { describe, expect, it } from 'vitest';
import { LocationCreateSchema, LocationUpdateSchema, PlanRequestSchema } from './schemas';

describe('LocationCreateSchema', () => {
    const valid = { name: 'Au Cheval', latitude: 41.88, longitude: -87.65 };

    it('accepts a minimal location', () => {
        expect(LocationCreateSchema.parse(valid)).toMatchObject(valid);
    });

    it('rejects out-of-range coordinates and NaN', () => {
        expect(LocationCreateSchema.safeParse({ ...valid, latitude: 91 }).success).toBe(false);
        expect(LocationCreateSchema.safeParse({ ...valid, longitude: Number.NaN }).success).toBe(false);
    });

    it('requires a non-blank name', () => {
        expect(LocationCreateSchema.safeParse({ ...valid, name: '   ' }).success).toBe(false);
    });

    it('normalizes empty strings to null so fields can be cleared', () => {
        const parsed = LocationCreateSchema.parse({ ...valid, website: '', description: '' });
        expect(parsed.website).toBeNull();
        expect(parsed.description).toBeNull();
    });

    it('only allows http(s) links', () => {
        expect(LocationCreateSchema.safeParse({ ...valid, website: 'https://example.com' }).success).toBe(true);
        expect(LocationCreateSchema.safeParse({ ...valid, website: 'javascript:alert(1)' }).success).toBe(false);
    });

    it('validates opening hours', () => {
        const bad = { ...valid, openHours: { mon: { isOpen: true, open: '25:00', close: '02:00' } } };
        expect(LocationCreateSchema.safeParse(bad).success).toBe(false);
    });
});

describe('LocationUpdateSchema', () => {
    it('allows partial updates and leaves omitted fields undefined', () => {
        const parsed = LocationUpdateSchema.parse({ isConfirmed: true });
        expect(parsed).toEqual({ isConfirmed: true });
        expect('latitude' in parsed).toBe(false);
    });
});

describe('PlanRequestSchema', () => {
    it('applies defaults', () => {
        expect(PlanRequestSchema.parse({})).toMatchObject({
            durationHours: 4,
            categoryIds: [],
            vibes: [],
            transportMode: 'drive',
            maxStops: 5,
        });
    });

    it('requires startTime to carry a timezone', () => {
        expect(PlanRequestSchema.safeParse({ startTime: '2026-11-17T20:00:00.000Z' }).success).toBe(true);
        expect(PlanRequestSchema.safeParse({ startTime: '2026-11-17T20:00:00-06:00' }).success).toBe(true);
        // A bare local time is ambiguous — the server would interpret it in its own TZ.
        expect(PlanRequestSchema.safeParse({ startTime: '2026-11-17T20:00' }).success).toBe(false);
    });
});
