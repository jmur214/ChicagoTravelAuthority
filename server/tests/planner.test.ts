import { describe, expect, it } from 'vitest';
import { buildItinerary, targetEnergy, vibeMatchPercent, type PlannerCandidate, type PlannerCriteria } from '../src/services/planning/planner';

const ALWAYS_OPEN = Object.fromEntries(
    ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(d => [d, { isOpen: true, open: '00:00', close: '00:00' }]),
);

const cand = (overrides: Partial<PlannerCandidate> & { id: number }): PlannerCandidate => ({
    name: `Place ${overrides.id}`,
    description: null,
    latitude: 41.8781,
    longitude: -87.6298,
    avgCost: 2,
    avgStayMinutes: 60,
    openHours: null,
    tagNames: [],
    categoryIds: [],
    categoryNames: new Map(),
    ...overrides,
});

const criteria = (overrides: Partial<PlannerCriteria> = {}): PlannerCriteria => ({
    startLocation: { lat: 41.8781, lng: -87.6298 },
    // Mon 2026-11-16 19:00 CST
    startTime: new Date('2026-11-17T01:00:00Z'),
    durationHours: 4,
    vibes: [],
    categoryIds: [],
    transportMode: 'drive',
    maxStops: 5,
    ...overrides,
});

describe('buildItinerary', () => {
    it('returns an empty plan when there are no candidates', () => {
        expect(buildItinerary([], criteria())).toEqual([]);
    });

    it('prefers category matches over plain proximity', () => {
        const near = cand({ id: 1 });
        const matching = cand({ id: 2, latitude: 41.885, categoryIds: [7], categoryNames: new Map([[7, 'Nightlife']]) });
        const plan = buildItinerary([near, matching], criteria({ categoryIds: [7], maxStops: 1 }));
        expect(plan).toHaveLength(1);
        expect(plan[0]).toMatchObject({ locationId: 2, reason: 'Matches: Nightlife' });
    });

    it('never visits the same place twice and respects maxStops', () => {
        const places = [1, 2, 3, 4].map(id => cand({ id, latitude: 41.8781 + id * 0.001 }));
        const plan = buildItinerary(places, criteria({ maxStops: 3 }));
        expect(plan.map(p => p.locationId)).toHaveLength(3);
        expect(new Set(plan.map(p => p.locationId)).size).toBe(3);
        expect(plan.map(p => p.order)).toEqual([1, 2, 3]);
    });

    it('stops adding stops once the time budget is spent', () => {
        const places = [1, 2, 3, 4, 5].map(id => cand({ id, avgStayMinutes: 90 }));
        // 3h budget, 90m stays at the same spot -> 2 stops
        expect(buildItinerary(places, criteria({ durationHours: 3 }))).toHaveLength(2);
    });

    it('chains arrival times: stay + travel', () => {
        const a = cand({ id: 1, avgStayMinutes: 60 });
        const b = cand({ id: 2, avgStayMinutes: 60, latitude: 41.8781 + 0.09 }); // ~10km
        const plan = buildItinerary([a, b], criteria());
        expect(plan[0].arrivalTime).toBe('2026-11-17T01:00:00.000Z');
        expect(plan[0].departureTime).toBe('2026-11-17T02:00:00.000Z');
        // 10km at 30km/h = 20 min
        expect(plan[1].travelTimeMinutes).toBe(20);
        expect(new Date(plan[1].arrivalTime).getTime()).toBeGreaterThan(new Date(plan[0].departureTime).getTime());
    });

    it('excludes places farther than walking range in walk mode', () => {
        const far = cand({ id: 1, latitude: 41.8781 + 0.05 }); // ~5.5km
        expect(buildItinerary([far], criteria({ transportMode: 'walk' }))).toEqual([]);
        expect(buildItinerary([far], criteria({ transportMode: 'drive' }))).toHaveLength(1);
    });

    it('skips places that are closed on arrival, but keeps unknown hours', () => {
        const brunchSpot = cand({ id: 1, openHours: { mon: { isOpen: true, open: '08:00', close: '14:00' } } });
        const bar = cand({ id: 2, openHours: ALWAYS_OPEN });
        const unknown = cand({ id: 3, openHours: null });
        const plan = buildItinerary([brunchSpot, bar, unknown], criteria());
        expect(plan.map(p => p.locationId).sort()).toEqual([2, 3]);
    });

    it('penalizes places outside the budget', () => {
        const cheap = cand({ id: 1, avgCost: 1 });
        const pricey = cand({ id: 2, avgCost: 4 });
        const plan = buildItinerary([pricey, cheap], criteria({ budget: 1, maxStops: 1 }));
        expect(plan[0].locationId).toBe(1);
    });

    it('marks every planner pick as open on arrival (or unknown) and carries the travel mode', () => {
        const plan = buildItinerary([cand({ id: 1, openHours: ALWAYS_OPEN }), cand({ id: 2 })], criteria({ transportMode: 'transit' }));
        expect(plan.map(p => p.isOpenOnArrival).sort()).toEqual([null, true].sort());
        expect(plan.every(p => p.travelMode === 'transit')).toBe(true);
    });

    describe('energy level', () => {
        const museum = cand({ id: 1, tagNames: ['Museum'] });
        const club = cand({ id: 2, tagNames: ['Nightclub', 'Dance'] });
        const unknown = cand({ id: 3, tagNames: ['Misc'] });

        it('prefers calm places for a chill night and loud ones for chaos', () => {
            expect(buildItinerary([club, museum], criteria({ energyLevel: 1, maxStops: 1 }))[0].locationId).toBe(1);
            expect(buildItinerary([museum, club], criteria({ energyLevel: 5, maxStops: 1 }))[0].locationId).toBe(2);
        });

        it('warms up: the first stop targets one level below the requested energy', () => {
            expect(targetEnergy(5, 0)).toBe(4);
            expect(targetEnergy(5, 1)).toBe(5);
            expect(targetEnergy(1, 0)).toBe(1);
            const bar = cand({ id: 4, tagNames: ['Live Music'] }); // energy 4
            const plan = buildItinerary([club, bar], criteria({ energyLevel: 5 }));
            expect(plan.map(p => p.locationId)).toEqual([4, 2]);
        });

        it('does not penalize places whose energy is unknown', () => {
            // Unknown vs. a perfect-energy match at the same spot: tie-break by input order.
            expect(buildItinerary([unknown, museum], criteria({ energyLevel: 1, maxStops: 1 }))[0].locationId).toBe(3);
        });
    });
});

describe('vibeMatchPercent', () => {
    it('is high for a perfect fit and ignores distance', () => {
        expect(vibeMatchPercent({ matches: 1, budgetSteps: 0, energySteps: 0 }, true)).toBe(99);
    });

    it('drops when nothing requested matches, or budget/energy are off', () => {
        expect(vibeMatchPercent({ matches: 0, budgetSteps: 0, energySteps: 0 }, true)).toBe(50);
        expect(vibeMatchPercent({ matches: 1, budgetSteps: 3, energySteps: 4 }, true)).toBe(50);
    });

    it('treats unknown budget/energy as neutral', () => {
        expect(vibeMatchPercent({ matches: 0, budgetSteps: null, energySteps: null }, false)).toBe(99);
    });
});
