import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { CtaService } from '../src/services/transit/ctaService';
import { GtfsService } from '../src/services/transit/gtfsService';

const runIntegration = !!process.env.TEST_DATABASE_URL;

describe.skipIf(!runIntegration)('API (integration)', () => {
    const app = createApp({ cta: new CtaService(undefined), gtfs: new GtfsService('/nonexistent') });
    const api = request(app);

    beforeEach(async () => {
        await prisma.$executeRawUnsafe(
            'TRUNCATE "LocationTag", "Location", "Tag", "TagCategory", "_LocationToTagCategory", "_TagToTagCategory" RESTART IDENTITY CASCADE',
        );
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    const createLocation = (body: object) =>
        api.post('/api/v1/locations').send({ name: 'Test Bar', latitude: 41.9, longitude: -87.65, ...body });

    describe('locations', () => {
        it('creates a location and hides it from the public list until confirmed', async () => {
            const created = await createLocation({ website: 'https://example.com' }).expect(201);
            expect(created.body).toMatchObject({ name: 'Test Bar', isConfirmed: false, website: 'https://example.com', tags: [], categories: [] });

            expect((await api.get('/api/v1/locations').expect(200)).body).toHaveLength(0);
            expect((await api.get('/api/v1/locations?all=true').expect(200)).body).toHaveLength(1);
        });

        it('rejects invalid input with a structured validation error', async () => {
            const res = await createLocation({ latitude: 'not a number', website: 'javascript:alert(1)' }).expect(400);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
            const paths = res.body.error.details.map((d: { path: string }) => d.path);
            expect(paths).toEqual(expect.arrayContaining(['latitude', 'website']));
        });

        // Regression: the old PUT handler did Number(undefined) on omitted lat/lng -> NaN -> 500,
        // which broke the admin "Approve Data" and "Mark Vibe" buttons.
        it('supports partial updates without touching other fields', async () => {
            const { body: loc } = await createLocation({ description: 'Keep me' }).expect(201);

            const res = await api.patch(`/api/v1/locations/${loc.id}`).send({ isConfirmed: true }).expect(200);
            expect(res.body).toMatchObject({ isConfirmed: true, latitude: 41.9, longitude: -87.65, description: 'Keep me' });

            await api.put(`/api/v1/locations/${loc.id}`).send({ verifiedVibe: true }).expect(200);
            expect((await api.get(`/api/v1/locations/${loc.id}`)).body.verifiedVibe).toBe(true);
        });

        // Regression: website/menuUrl/eventsInfo were silently dropped on update.
        it('persists link fields on update, and "" clears them', async () => {
            const { body: loc } = await createLocation({}).expect(201);
            await api.patch(`/api/v1/locations/${loc.id}`).send({ menuUrl: 'https://menu.example', eventsInfo: 'HH 4-6' }).expect(200);
            let current = (await api.get(`/api/v1/locations/${loc.id}`)).body;
            expect(current).toMatchObject({ menuUrl: 'https://menu.example', eventsInfo: 'HH 4-6' });

            await api.patch(`/api/v1/locations/${loc.id}`).send({ menuUrl: '' }).expect(200);
            current = (await api.get(`/api/v1/locations/${loc.id}`)).body;
            expect(current.menuUrl).toBeNull();
            expect(current.eventsInfo).toBe('HH 4-6');
        });

        it('replaces tags and categories when ids are provided', async () => {
            const t1 = (await api.post('/api/v1/tags').send({ name: 'Cocktails' }).expect(201)).body;
            const t2 = (await api.post('/api/v1/tags').send({ name: 'Rooftop' }).expect(201)).body;
            const cat = (await api.post('/api/v1/categories').send({ name: 'Nightlife' }).expect(201)).body;

            const { body: loc } = await createLocation({ tagIds: [t1.id] }).expect(201);
            expect(loc.tags.map((t: { tag: { name: string } }) => t.tag.name)).toEqual(['Cocktails']);

            const updated = (await api.patch(`/api/v1/locations/${loc.id}`).send({ tagIds: [t2.id], categoryIds: [cat.id] }).expect(200)).body;
            expect(updated.tags.map((t: { tag: { name: string } }) => t.tag.name)).toEqual(['Rooftop']);
            expect(updated.categories.map((c: { name: string }) => c.name)).toEqual(['Nightlife']);
        });

        // Regression: LocationTag FKs were ON DELETE RESTRICT, so deleting a tagged location failed.
        it('deletes a tagged location', async () => {
            const tag = (await api.post('/api/v1/tags').send({ name: 'Dive' })).body;
            const { body: loc } = await createLocation({ tagIds: [tag.id] }).expect(201);
            await api.delete(`/api/v1/locations/${loc.id}`).expect(204);
            await api.get(`/api/v1/locations/${loc.id}`).expect(404);
        });

        it('returns 404 for unknown ids and 400 for malformed ids', async () => {
            expect((await api.patch('/api/v1/locations/9999').send({ name: 'x' }).expect(404)).body.error.code).toBe('NOT_FOUND');
            await api.get('/api/v1/locations/abc').expect(400);
        });

        it('returns 400 for references to unknown tags', async () => {
            await createLocation({ tagIds: [9999] }).expect(400);
        });
    });

    describe('tags & categories', () => {
        it('deleting a tag detaches it from locations instead of failing', async () => {
            const tag = (await api.post('/api/v1/tags').send({ name: 'Patio' })).body;
            const { body: loc } = await createLocation({ tagIds: [tag.id] });
            await api.delete(`/api/v1/tags/${tag.id}`).expect(204);
            expect((await api.get(`/api/v1/locations/${loc.id}`).expect(200)).body.tags).toEqual([]);
        });

        it('links and unlinks categories on a tag', async () => {
            const tag = (await api.post('/api/v1/tags').send({ name: 'Jazz' })).body;
            const cat = (await api.post('/api/v1/categories').send({ name: 'Music' })).body;
            const linked = (await api.post(`/api/v1/tags/${tag.id}/categories`).send({ categoryId: cat.id }).expect(200)).body;
            expect(linked.categories).toHaveLength(1);
            const unlinked = (await api.delete(`/api/v1/tags/${tag.id}/categories/${cat.id}`).expect(200)).body;
            expect(unlinked.categories).toHaveLength(0);
        });

        it('rejects duplicate names with 409', async () => {
            await api.post('/api/v1/categories').send({ name: 'Food' }).expect(201);
            expect((await api.post('/api/v1/categories').send({ name: 'Food' }).expect(409)).body.error.code).toBe('CONFLICT');
        });

        it('prevents category cycles', async () => {
            const parent = (await api.post('/api/v1/categories').send({ name: 'Parent' })).body;
            const child = (await api.post('/api/v1/categories').send({ name: 'Child', parentId: parent.id }).expect(201)).body;
            await api.patch(`/api/v1/categories/${parent.id}`).send({ parentId: child.id }).expect(400);
            await api.patch(`/api/v1/categories/${parent.id}`).send({ parentId: parent.id }).expect(400);
        });

        it('validates category color and shape', async () => {
            await api.post('/api/v1/categories').send({ name: 'X', color: 'red' }).expect(400);
            await api.post('/api/v1/categories').send({ name: 'X', shape: 'hexagon' }).expect(400);
            await api.post('/api/v1/categories').send({ name: 'X', color: '#FF0099', shape: 'star' }).expect(201);
        });
    });

    describe('import', () => {
        const kml = `<kml><Document><name>My Places</name><Folder><name>Bars</name>
            <Placemark><name>Spot A</name><Point><coordinates>-87.65,41.90</coordinates></Point></Placemark>
            <Placemark><name>Spot B</name><Point><coordinates>-87.66,41.91</coordinates></Point></Placemark>
            </Folder></Document></kml>`;

        it('imports placemarks as unconfirmed locations tagged by folder, and is idempotent', async () => {
            const first = await api.post('/api/v1/import').attach('file', Buffer.from(kml), 'places.kml').expect(200);
            expect(first.body).toEqual({ total: 2, imported: 2, updated: 0, errors: 0 });

            const second = await api.post('/api/v1/import').attach('file', Buffer.from(kml), 'places.kml').expect(200);
            expect(second.body).toEqual({ total: 2, imported: 0, updated: 2, errors: 0 });

            const all = (await api.get('/api/v1/locations?all=true')).body;
            expect(all).toHaveLength(2);
            expect(all[0].tags.map((t: { tag: { name: string } }) => t.tag.name)).toEqual(['Bars']);
        });

        it('requires a file', async () => {
            await api.post('/api/v1/import').expect(400);
        });
    });

    describe('planning', () => {
        it('plans only confirmed locations and returns { items }', async () => {
            const cat = (await api.post('/api/v1/categories').send({ name: 'Nightlife' })).body;
            await createLocation({ name: 'Confirmed', isConfirmed: true, categoryIds: [cat.id] });
            await createLocation({ name: 'Pending', isConfirmed: false, categoryIds: [cat.id] });

            const res = await api
                .post('/api/v1/plan')
                .send({ categoryIds: [cat.id], startTime: '2026-11-17T01:00:00Z', energyLevel: 3 })
                .expect(200);
            expect(res.body.items.map((i: { name: string }) => i.name)).toEqual(['Confirmed']);
            expect(res.body.items[0].reason).toBe('Matches: Nightlife');
        });

        it('starts from the chosen neighborhood and echoes the resolved inputs', async () => {
            await createLocation({ name: 'Wicker Spot', isConfirmed: true, latitude: 41.9105, longitude: -87.6775 });
            await createLocation({ name: 'Loop Spot', isConfirmed: true, latitude: 41.8821, longitude: -87.6279 });

            const res = await api
                .post('/api/v1/plan')
                .send({ neighborhood: 'the-loop', startTime: '2026-11-17T01:00:00Z', transportMode: 'walk', maxStops: 1 })
                .expect(200);
            expect(res.body.items[0]).toMatchObject({ name: 'Loop Spot', travelMode: 'walk', isOpenOnArrival: null });
            expect(res.body).toMatchObject({
                startTime: '2026-11-17T01:00:00.000Z',
                startLocation: { lat: 41.882, lng: -87.6278 },
                transportMode: 'walk',
            });

            await api.post('/api/v1/plan').send({ neighborhood: 'atlantis' }).expect(400);
        });

        it('rejects ambiguous start times', async () => {
            await api.post('/api/v1/plan').send({ startTime: '2026-11-17T19:00' }).expect(400);
        });
    });

    describe('misc', () => {
        it('serves mock trains without an API key', async () => {
            const res = await api.get('/api/v1/trains').expect(200);
            expect(res.body.trains.length).toBeGreaterThan(0);
            expect(res.body.trains[0].isMock).toBe(true);
        });

        it('keeps the unversioned /api alias working', async () => {
            await api.get('/api/locations').expect(200);
            await api.get('/api/v1/health').expect(200);
        });

        it('returns JSON errors for unknown routes and malformed JSON', async () => {
            expect((await api.get('/api/v1/nope').expect(404)).body.error.code).toBe('NOT_FOUND');
            const res = await api.post('/api/v1/locations').set('Content-Type', 'application/json').send('{bad').expect(400);
            expect(res.body.error.code).toBe('BAD_REQUEST');
        });
    });
});
