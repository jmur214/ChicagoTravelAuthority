import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { PlaceCandidate } from '@cta/shared';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { toCandidate, type GPlace } from '../src/services/places/google';
import type { PlacesProvider, SearchBias } from '../src/services/places/provider';
import { CtaService } from '../src/services/transit/ctaService';
import { GtfsService } from '../src/services/transit/gtfsService';
import { PERMANENTLY_CLOSED, TEMPORARILY_CLOSED, VIOLET_HOUR } from './fixtures/googlePlaces';

/** In-memory stand-in for Google: search returns whatever the test set up. */
class FakePlaces implements PlacesProvider {
    readonly name = 'google' as const;
    byId = new Map<string, PlaceCandidate>();
    searchResults: PlaceCandidate[] = [];
    calls: string[] = [];

    add(...places: GPlace[]) {
        for (const p of places) this.byId.set(p.id, toCandidate(p)!);
        return this;
    }
    async search(query: string, _bias?: SearchBias) {
        this.calls.push(`search:${query}`);
        return this.searchResults;
    }
    async getPlace(id: string) {
        this.calls.push(`get:${id}`);
        const place = this.byId.get(id);
        if (!place) throw Object.assign(new Error('not found'), { status: 404 });
        return place;
    }
}

const runIntegration = !!process.env.TEST_DATABASE_URL;
const deps = { cta: new CtaService(undefined), gtfs: new GtfsService('/nonexistent') };

describe.skipIf(!runIntegration)('place enrichment API (integration)', () => {
    let fake: FakePlaces;
    let api: ReturnType<typeof request>;

    beforeEach(async () => {
        await prisma.$executeRawUnsafe(
            'TRUNCATE "LocationTag", "Location", "Tag", "TagCategory", "_LocationToTagCategory", "_TagToTagCategory" RESTART IDENTITY CASCADE',
        );
        fake = new FakePlaces().add(VIOLET_HOUR, TEMPORARILY_CLOSED, PERMANENTLY_CLOSED);
        api = request(createApp({ ...deps, places: fake }));
    });
    afterAll(() => prisma.$disconnect());

    /** Simulates a KML import: only name + coordinates. */
    const importedPlace = (name: string, latitude = 41.9087, longitude = -87.6777) =>
        prisma.location.create({ data: { name, latitude, longitude, isConfirmed: true } });

    it('reports when no API key is configured', async () => {
        const unconfigured = request(createApp(deps));
        expect((await unconfigured.get('/api/v1/places/status').expect(200)).body).toEqual({ provider: 'google', configured: false });
        const loc = await importedPlace('Somewhere');
        const res = await unconfigured.post(`/api/v1/locations/${loc.id}/enrich`).expect(503);
        expect(res.body.error.code).toBe('NOT_CONFIGURED');
    });

    it('auto-matches a confident result and fills in real data with provenance', async () => {
        const loc = await importedPlace('Violet Hour');
        fake.searchResults = [fake.byId.get('ChIJviolethour')!];

        const { body } = await api.post(`/api/v1/locations/${loc.id}/enrich`).expect(200);
        expect(body.status).toBe('matched');
        expect(body.changes.map((c: { field: string }) => c.field)).toEqual(
            expect.arrayContaining(['address', 'phoneNumber', 'website', 'openHours', 'rating', 'avgCost', 'description', 'googleMapsUrl']),
        );
        expect(body.location).toMatchObject({
            name: 'Violet Hour', // your name is kept
            googlePlaceId: 'ChIJviolethour',
            matchStatus: 'matched',
            website: 'https://www.theviolethour.com/',
            businessStatus: 'OPERATIONAL',
            matchCandidates: null,
        });
        expect(body.location.openHours.fri).toEqual({ isOpen: true, open: '16:00', close: '03:00' });
        expect(body.location.fieldSources.website.source).toBe('google');
        expect(body.location.enrichedAt).toBeTruthy();
        expect(body.location.metadata.placeTypes).toContain('bar');
    });

    it('refreshes matched places by id, and never overwrites your edits', async () => {
        const loc = await importedPlace('Violet Hour');
        fake.searchResults = [fake.byId.get('ChIJviolethour')!];
        await api.post(`/api/v1/locations/${loc.id}/enrich`).expect(200);

        await api.patch(`/api/v1/locations/${loc.id}`).send({ website: 'https://my-preferred-link.com' }).expect(200);

        fake.calls = [];
        const { body } = await api.post(`/api/v1/locations/${loc.id}/enrich`).expect(200);
        expect(fake.calls).toEqual(['get:ChIJviolethour']); // no new search
        expect(body.location.website).toBe('https://my-preferred-link.com');
        expect(body.location.fieldSources.website.source).toBe('manual');
        expect(body.changes).toEqual([]);
    });

    it('queues ambiguous results for review, then applies the one you pick', async () => {
        const loc = await importedPlace('Violet Hour');
        const twin = { ...fake.byId.get('ChIJviolethour')!, externalId: 'ChIJtwin', name: 'Violet Hour Lounge' };
        fake.byId.set('ChIJtwin', twin);
        fake.searchResults = [fake.byId.get('ChIJviolethour')!, twin];

        const review = (await api.post(`/api/v1/locations/${loc.id}/enrich`).expect(200)).body;
        expect(review.status).toBe('needs_review');
        expect(review.candidates).toHaveLength(2);
        expect(review.location.website).toBeNull(); // nothing applied yet

        const listed = (await api.get('/api/v1/locations?all=true')).body[0];
        expect(listed.matchStatus).toBe('needs_review');
        expect(listed.matchCandidates).toHaveLength(2);

        const picked = (await api.post(`/api/v1/locations/${loc.id}/match`).send({ externalId: 'ChIJviolethour' }).expect(200)).body;
        expect(picked.location).toMatchObject({ matchStatus: 'matched', googlePlaceId: 'ChIJviolethour', matchCandidates: null });
    });

    it('records "no match" with what was found, and "not on Google" stops future lookups', async () => {
        const loc = await importedPlace('My Friend’s Rooftop');
        fake.searchResults = [fake.byId.get('ChIJgone')!];
        const none = (await api.post(`/api/v1/locations/${loc.id}/enrich`).expect(200)).body;
        expect(none.status).toBe('no_match');
        expect(none.candidates).toHaveLength(1);

        await api.post(`/api/v1/locations/${loc.id}/match`).send({ ignore: true }).expect(200);
        fake.calls = [];
        const again = (await api.post(`/api/v1/locations/${loc.id}/enrich`).expect(200)).body;
        expect(again.status).toBe('ignored');
        expect(fake.calls).toEqual([]);
    });

    it('adds a new place straight from Google, and refuses duplicates', async () => {
        const created = await api.post('/api/v1/locations/from-place').send({ externalId: 'ChIJviolethour', isConfirmed: true }).expect(201);
        expect(created.body.location).toMatchObject({
            name: 'The Violet Hour',
            isConfirmed: true,
            matchStatus: 'matched',
            address: '1520 N Damen Ave, Chicago, IL 60622, USA',
            latitude: 41.90865,
        });
        const dup = await api.post('/api/v1/locations/from-place').send({ externalId: 'ChIJviolethour' }).expect(409);
        expect(dup.body.error.message).toMatch(/Already in your places as "The Violet Hour"/);
    });

    it('searches and ranks results by name similarity', async () => {
        fake.searchResults = [fake.byId.get('ChIJgone')!, fake.byId.get('ChIJviolethour')!];
        const { body } = await api.get('/api/v1/places/search').query({ q: 'violet hour' }).expect(200);
        expect(body[0].externalId).toBe('ChIJviolethour');
        expect(body[0].nameScore).toBeGreaterThan(body[1].nameScore);
        await api.get('/api/v1/places/search').query({ q: 'x' }).expect(400);
    });

    it('hides permanently closed places from the map and keeps closed places out of plans', async () => {
        const gone = await importedPlace('The Gone Bar', 41.9, -87.66);
        fake.searchResults = [fake.byId.get('ChIJgone')!];
        await api.post(`/api/v1/locations/${gone.id}/enrich`).expect(200);

        const reno = await importedPlace('Old Town Ale House', 41.9112, -87.6343);
        fake.searchResults = [fake.byId.get('ChIJreno')!];
        await api.post(`/api/v1/locations/${reno.id}/enrich`).expect(200);

        await importedPlace('Open Spot', 41.9, -87.65);

        const publicNames = (await api.get('/api/v1/locations')).body.map((l: { name: string }) => l.name);
        expect(publicNames).toEqual(['Old Town Ale House', 'Open Spot']); // temporarily closed still listed
        const admin = (await api.get('/api/v1/locations?all=true')).body;
        expect(admin).toHaveLength(3);

        const plan = (await api.post('/api/v1/plan').send({ startTime: '2026-11-21T01:00:00Z' }).expect(200)).body;
        expect(plan.items.map((i: { name: string }) => i.name)).toEqual(['Open Spot']);
    });

    it('marks KML-imported coordinates as coming from KML', async () => {
        const kml = `<kml><Document><Placemark><name>KML Spot</name><description>Great patio</description>
            <Point><coordinates>-87.65,41.90</coordinates></Point></Placemark></Document></kml>`;
        await api.post('/api/v1/import').attach('file', Buffer.from(kml), 'p.kml').expect(200);
        const [loc] = (await api.get('/api/v1/locations?all=true')).body;
        expect(loc.fieldSources.latitude.source).toBe('kml');
        expect(loc.fieldSources.description.source).toBe('kml');
    });
});
