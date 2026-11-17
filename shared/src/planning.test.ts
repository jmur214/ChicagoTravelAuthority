import { describe, expect, it } from 'vitest';
import { estimateEnergy } from './energy';
import { getNeighborhood, NEIGHBORHOODS } from './neighborhoods';
import { isOpenAt, scheduleStops, type ScheduleStop } from './planning';
import { PlanRequestSchema } from './schemas';

describe('estimateEnergy', () => {
    it.each([
        [['Nightclub'], 5],
        [['Bars', 'Cocktails'], 3],
        [['Museum', 'History'], 1],
        [['Live Music', 'Late Night'], 4],
        [['Coffee', 'Bars'], 2],
    ])('%j -> %d', (labels, expected) => {
        expect(estimateEnergy(labels)).toBe(expected);
    });

    it('matches whole words only', () => {
        expect(estimateEnergy(['Barbecue'])).toBeNull();
        expect(estimateEnergy(['Clubhouse Sandwiches'])).toBeNull();
    });

    it('returns null when nothing is recognized', () => {
        expect(estimateEnergy(['Other Cities', 'Misc'])).toBeNull();
        expect(estimateEnergy([])).toBeNull();
    });
});

describe('neighborhoods', () => {
    it('are all inside Chicago and accepted by the plan schema', () => {
        for (const n of NEIGHBORHOODS) {
            expect(n.center.lat).toBeGreaterThan(41.6);
            expect(n.center.lat).toBeLessThan(42.1);
            expect(PlanRequestSchema.safeParse({ neighborhood: n.id }).success).toBe(true);
        }
        expect(PlanRequestSchema.safeParse({ neighborhood: 'atlantis' }).success).toBe(false);
        expect(getNeighborhood('wicker-park')?.name).toBe('Wicker Park');
    });
});

describe('scheduleStops', () => {
    const stop = (id: number, lat: number, extra: Partial<ScheduleStop> = {}): ScheduleStop => ({
        locationId: id, name: `S${id}`, description: null, latitude: lat, longitude: -87.63,
        avgStayMinutes: 60, openHours: null, ...extra,
    });
    // Mon 2026-11-16 20:00 CST
    const start = new Date('2026-11-17T02:00:00Z');

    it('starts at the first stop when there is no start location', () => {
        const [first] = scheduleStops([stop(1, 41.88)], { startTime: start, transportMode: 'walk', startLocation: null });
        expect(first).toMatchObject({ travelTimeMinutes: 0, arrivalTime: start.toISOString(), reason: 'Added by you', matchScore: 0 });
    });

    it('chains travel and stay times in order and numbers stops', () => {
        // ~1.1km apart; walking 5km/h = ~13 min
        const items = scheduleStops([stop(1, 41.88), stop(2, 41.89)], { startTime: start, transportMode: 'walk', startLocation: null });
        expect(items.map(i => i.order)).toEqual([1, 2]);
        expect(items[1].travelTimeMinutes).toBe(13);
        expect(items[1].travelMode).toBe('walk');
        const gap = (Date.parse(items[1].arrivalTime) - Date.parse(items[0].departureTime)) / 60_000;
        expect(Math.round(gap)).toBe(13);
    });

    it('keeps planner reasons/scores and flags places closed on arrival', () => {
        const brunch = { mon: { isOpen: true, open: '08:00', close: '14:00' } };
        const [item] = scheduleStops([stop(1, 41.88, { reason: 'Matches: Food', matchScore: 80, openHours: brunch })], {
            startTime: start, transportMode: 'drive', startLocation: null,
        });
        expect(item).toMatchObject({ reason: 'Matches: Food', matchScore: 80, isOpenOnArrival: false });
    });

    it('isOpenAt is null for unknown hours', () => {
        expect(isOpenAt(null, start)).toBeNull();
    });
});
