import { describe, expect, it } from 'vitest';
import type { PlaceCandidate } from '@cta/shared';
import { planChanges } from '../src/services/places/enrichmentService';
import { confidenceFor, decideMatch, nameSimilarity, nameTokens, scoreCandidate } from '../src/services/places/matching';
import { markManualEdits } from '../src/services/locationService';

const candidate = (overrides: Partial<PlaceCandidate> = {}): PlaceCandidate => ({
    provider: 'google', externalId: 'g1', name: 'The Violet Hour', address: '1520 N Damen Ave', latitude: 41.90865,
    longitude: -87.67765, openHours: null, phoneNumber: null, website: null, rating: null, reviewCount: null,
    avgCost: null, businessStatus: 'OPERATIONAL', googleMapsUrl: null, types: [], summary: null, ...overrides,
});

describe('nameSimilarity', () => {
    it.each([
        ['The Violet Hour', 'Violet Hour', 1],
        ["Lou Malnati's", "Lou Malnati's Pizzeria", 0.9],
        ['Portillos', "Portillo's Hot Dogs", 0.9],
        ['Café Ba-Ba-Reeba!', 'Cafe Ba Ba Reeba', 1],
        ['Big Star & Co', 'Big Star and Co', 1],
    ])('%s ≈ %s', (a, b, min) => {
        expect(nameSimilarity(a, b)).toBeGreaterThanOrEqual(min);
    });

    it('scores unrelated names low', () => {
        expect(nameSimilarity('The Violet Hour', 'Starbucks')).toBeLessThan(0.3);
        expect(nameSimilarity('Green Mill', 'Green Street Smoked Meats')).toBeLessThan(0.6);
    });

    it('ignores filler words', () => {
        expect(nameTokens('The Bar at the Chicago Athletic Association')).toEqual(['bar', 'athletic', 'association']);
        expect(nameTokens('Kingston Mines')).toEqual(nameTokens("Kingston Mine's"));
    });
});

describe('confidenceFor', () => {
    it('needs both proximity and a similar name for high confidence', () => {
        expect(confidenceFor(40, 0.95)).toBe('high');
        expect(confidenceFor(40, 0.45)).toBe('high'); // practically the same spot
        expect(confidenceFor(400, 0.95)).toBe('medium'); // right name, a few blocks off
        expect(confidenceFor(40, 0.2)).toBe('low'); // same building, different business
        expect(confidenceFor(5000, 1)).toBe('low');
    });
});

describe('decideMatch', () => {
    const target = { name: 'The Violet Hour', latitude: 41.9087, longitude: -87.6777 };

    it('auto-applies a single confident match', () => {
        const decision = decideMatch([
            scoreCandidate(target, candidate()),
            scoreCandidate(target, candidate({ externalId: 'g2', name: 'Big Star', latitude: 41.9091, longitude: -87.6772 })),
        ]);
        expect(decision.kind).toBe('auto');
        if (decision.kind === 'auto') expect(decision.best.externalId).toBe('g1');
    });

    it('sends two plausible same-name listings to review', () => {
        const decision = decideMatch([
            scoreCandidate(target, candidate()),
            scoreCandidate(target, candidate({ externalId: 'g2', name: 'Violet Hour Lounge', latitude: 41.9088, longitude: -87.6776 })),
        ]);
        expect(decision.kind).toBe('review');
    });

    it('sends a right-name-wrong-spot match to review', () => {
        const decision = decideMatch([scoreCandidate(target, candidate({ latitude: 41.912, longitude: -87.6777 }))]); // ~370m
        expect(decision.kind).toBe('review');
    });

    it('reports no match when nothing is plausible, but keeps what was found', () => {
        const decision = decideMatch([scoreCandidate(target, candidate({ name: 'Starbucks' }))]);
        expect(decision.kind).toBe('none');
        if (decision.kind === 'none') expect(decision.candidates).toHaveLength(1);
    });
});

describe('planChanges', () => {
    const AT = '2026-11-20T00:00:00.000Z';
    const hours = { mon: { isOpen: true, open: '17:00', close: '02:00' } };

    it('fills empty fields from the provider and records provenance', () => {
        const { data, fieldSources, changes } = planChanges({ website: null, phoneNumber: null, fieldSources: null },
            candidate({ website: 'https://x.com', phoneNumber: '(312) 555-0100' }), AT);
        expect(data).toMatchObject({ website: 'https://x.com', phoneNumber: '(312) 555-0100' });
        expect(fieldSources.website).toEqual({ source: 'google', at: AT });
        expect(changes.map(c => c.field)).toEqual(expect.arrayContaining(['website', 'phoneNumber']));
    });

    it('never overwrites values you entered by hand', () => {
        const { data } = planChanges(
            { website: 'https://mine.com', fieldSources: { website: { source: 'manual', at: AT } } },
            candidate({ website: 'https://google.com' }), AT);
        expect(data).not.toHaveProperty('website');
    });

    it('replaces estimated hours, and clears them when the provider has none', () => {
        const estimated = { openHours: { mon: { isOpen: true, open: '09:00', close: '21:00' } }, fieldSources: { openHours: { source: 'estimate', at: AT } } };
        expect(planChanges(estimated, candidate({ openHours: hours }), AT).data.openHours).toEqual(hours);
        const cleared = planChanges(estimated, candidate({ openHours: null }), AT);
        expect(cleared.data.openHours).toBeNull();
        expect(cleared.fieldSources.openHours).toBeUndefined();
    });

    it('keeps values of unknown origin when the provider has nothing', () => {
        const { data } = planChanges({ phoneNumber: '(312) 555-0199', fieldSources: null }, candidate({ phoneNumber: null }), AT);
        expect(data).not.toHaveProperty('phoneNumber');
    });

    it("only uses the provider's summary when you have no description", () => {
        const summary = 'Upscale cocktail lounge.';
        expect(planChanges({ description: null }, candidate({ summary }), AT).data.description).toBe(summary);
        expect(planChanges({ description: 'My note: ask for the back room' }, candidate({ summary }), AT).data).not.toHaveProperty('description');
    });

    it('reports no changes when nothing differs', () => {
        const c = candidate({ website: 'https://x.com' });
        const current = { website: 'https://x.com', address: c.address, latitude: c.latitude, longitude: c.longitude, businessStatus: c.businessStatus };
        expect(planChanges(current, c, AT).changes).toEqual([]);
    });
});

describe('markManualEdits', () => {
    it('marks only fields that actually changed', () => {
        const current = { website: 'https://a.com', phoneNumber: '1', fieldSources: { phoneNumber: { source: 'google', at: 'x' } } };
        const sources = markManualEdits(current, { website: 'https://b.com', phoneNumber: '1', name: 'ignored' }, 'now')!;
        expect(sources.website).toEqual({ source: 'manual', at: 'now' });
        expect(sources.phoneNumber).toEqual({ source: 'google', at: 'x' });
    });

    it('returns undefined when nothing enrichable changed', () => {
        expect(markManualEdits({ website: 'https://a.com' }, { website: 'https://a.com', isConfirmed: true })).toBeUndefined();
    });
});

describe('deepEqual (JSONB round-trips)', () => {
    it('ignores key order and treats null/undefined alike', async () => {
        const { deepEqual } = await import('../src/lib/deepEqual');
        expect(deepEqual({ mon: { isOpen: true, open: '17:00', close: '02:00' } }, { mon: { close: '02:00', open: '17:00', isOpen: true } })).toBe(true);
        expect(deepEqual({ a: 1, b: undefined }, { a: 1 })).toBe(true);
        expect(deepEqual(null, undefined)).toBe(true);
        expect(deepEqual([1, 2], [2, 1])).toBe(false);
        expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
    });
});
