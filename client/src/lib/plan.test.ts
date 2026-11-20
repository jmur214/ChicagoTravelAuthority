import { describe, expect, it } from 'vitest';
import type { Location } from '@cta/shared';
import { addStop, changeTransportMode, moveStop, nextQuarterHour, parseSavedPlan, removeStop, type Plan } from './plan';

const loc = (id: number, lat: number, extra: Partial<Location> = {}): Location => ({
    id, name: `Place ${id}`, description: null, latitude: lat, longitude: -87.63, address: null, googlePlaceId: null,
    phoneNumber: null, metadata: null, avgCost: 2, avgStayMinutes: 60, openHours: null, website: null, menuUrl: null,
    eventsInfo: null, rating: null, reviewCount: null, isConfirmed: true, verifiedVibe: false, userVerifiedCount: 0,
    businessStatus: null, googleMapsUrl: null, matchStatus: 'unmatched', matchCandidates: null, enrichedAt: null, fieldSources: null,
    createdAt: '', updatedAt: '', tags: [], categories: [], ...extra,
});

const A = loc(1, 41.88);
const B = loc(2, 41.89);
const C = loc(3, 41.9);
const all = [A, B, C];
// Mon 2026-11-16 20:00 CST
const NOW = new Date('2026-11-17T02:00:00Z');

const build = (...locs: Location[]) => locs.reduce<Plan | null>((p, l) => addStop(p, l, all, NOW), null)!;

describe('nextQuarterHour', () => {
    it('rounds up', () => {
        expect(nextQuarterHour(new Date('2026-11-17T02:07:00Z')).toISOString()).toBe('2026-11-17T02:15:00.000Z');
        expect(nextQuarterHour(NOW).toISOString()).toBe(NOW.toISOString());
    });
});

describe('addStop', () => {
    it('starts a new plan at the first stop', () => {
        const plan = addStop(null, A, all, NOW);
        expect(plan.items).toHaveLength(1);
        expect(plan.items[0]).toMatchObject({ locationId: 1, travelTimeMinutes: 0, arrivalTime: NOW.toISOString(), reason: 'Added by you' });
    });

    it('appends with travel time and ignores duplicates', () => {
        const plan = build(A, B);
        expect(plan.items.map(i => i.locationId)).toEqual([1, 2]);
        expect(plan.items[1].travelTimeMinutes).toBeGreaterThan(0);
        expect(addStop(plan, B, all, NOW)).toBe(plan);
    });

    it('flags a place that will be closed when you get there', () => {
        const brunch = loc(4, 41.88, { openHours: { mon: { isOpen: true, open: '08:00', close: '14:00' } } });
        expect(addStop(null, brunch, [brunch], NOW).items[0].isOpenOnArrival).toBe(false);
    });
});

describe('editing', () => {
    it('removes a stop and re-times the rest', () => {
        const plan = build(A, B, C);
        const next = removeStop(plan, 1, all)!;
        expect(next.items.map(i => [i.locationId, i.order])).toEqual([[2, 1], [3, 2]]);
        expect(next.items[0].arrivalTime).toBe(NOW.toISOString());
    });

    it('returns null when the last stop is removed', () => {
        expect(removeStop(build(A), 1, all)).toBeNull();
    });

    it('moves stops and ignores moves past the ends', () => {
        const plan = build(A, B, C);
        expect(moveStop(plan, 2, -1, all).items.map(i => i.locationId)).toEqual([1, 3, 2]);
        expect(moveStop(plan, 0, -1, all)).toBe(plan);
    });

    it('re-times when the transport mode changes', () => {
        const plan = build(A, B);
        const walking = changeTransportMode(plan, 'walk', all);
        expect(walking.transportMode).toBe('walk');
        expect(walking.items[1].travelTimeMinutes).toBeGreaterThan(plan.items[1].travelTimeMinutes);
    });

    it('keeps planner reasons and scores through edits', () => {
        const plan = build(A, B);
        plan.items[0] = { ...plan.items[0], reason: 'Matches: Food', matchScore: 88 };
        const moved = moveStop(plan, 0, 1, all);
        expect(moved.items[1]).toMatchObject({ locationId: 1, reason: 'Matches: Food', matchScore: 88 });
    });
});

describe('parseSavedPlan', () => {
    it('upgrades the old array format', () => {
        const legacy = [{ order: 1, locationId: 1, name: 'X', arrivalTime: '2026-11-17T02:10:00.000Z', departureTime: '2026-11-17T03:10:00.000Z', reason: 'r', coords: { lat: 41.88, lng: -87.63 }, travelTimeMinutes: 10, matchScore: 50 }];
        const plan = parseSavedPlan(legacy)!;
        expect(plan.startTime).toBe('2026-11-17T02:00:00.000Z');
        expect(plan.items[0]).toMatchObject({ travelMode: 'drive', isOpenOnArrival: null, description: '' });
    });

    it('rejects junk', () => {
        expect(parseSavedPlan(null)).toBeNull();
        expect(parseSavedPlan({ items: 'nope' })).toBeNull();
        expect(parseSavedPlan([])).toBeNull();
    });

    it('round-trips the current format', () => {
        const plan = build(A, B);
        expect(parseSavedPlan(JSON.parse(JSON.stringify(plan)))).toEqual(plan);
    });
});

