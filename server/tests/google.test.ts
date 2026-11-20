import http from 'http';
import type { AddressInfo } from 'net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getOpenStatus } from '@cta/shared';
import {
    DETAILS_FIELD_MASK,
    GooglePlacesProvider,
    googlePeriodsToOpenHours,
    SEARCH_FIELD_MASK,
    toCandidate,
} from '../src/services/places/google';
import { HttpError } from '../src/lib/httpError';
import { ALWAYS_OPEN, NO_HOURS, PERMANENTLY_CLOSED, SPLIT_SHIFT_DINER, TEMPORARILY_CLOSED, VIOLET_HOUR } from './fixtures/googlePlaces';

describe('googlePeriodsToOpenHours', () => {
    it('keeps overnight windows on the opening day', () => {
        const hours = googlePeriodsToOpenHours(VIOLET_HOUR.regularOpeningHours!.periods)!;
        expect(hours.mon).toEqual({ isOpen: true, open: '17:00', close: '02:00' });
        expect(hours.sat).toEqual({ isOpen: true, open: '16:00', close: '03:00' }); // wraps Sat → Sun
        expect(hours.sun).toEqual({ isOpen: false, open: '00:00', close: '00:00' });
        // Sun 2:30am CST is still Saturday night
        expect(getOpenStatus(hours, new Date('2026-11-22T08:30:00Z'))).toEqual({ state: 'open', closesAt: '03:00' });
    });

    it('keeps both lunch and dinner windows', () => {
        const hours = googlePeriodsToOpenHours(SPLIT_SHIFT_DINER.regularOpeningHours!.periods)!;
        expect(hours.tue).toEqual({ isOpen: true, open: '11:00', close: '14:30', additional: [{ open: '17:00', close: '22:00' }] });
        expect(hours.mon!.isOpen).toBe(false);
        // Tue 3:30pm CST — between shifts
        expect(getOpenStatus(hours, new Date('2026-11-17T21:30:00Z'))).toEqual({ state: 'closed', opensAt: '17:00' });
    });

    it('treats a single period without a close as 24/7', () => {
        const hours = googlePeriodsToOpenHours(ALWAYS_OPEN.regularOpeningHours!.periods)!;
        expect(Object.values(hours).every(d => d.isOpen && d.open === '00:00' && d.close === '00:00')).toBe(true);
    });

    it('distinguishes "never open" (empty list) from "unknown" (missing)', () => {
        const closed = googlePeriodsToOpenHours([])!;
        expect(Object.values(closed).every(d => !d.isOpen)).toBe(true);
        expect(googlePeriodsToOpenHours(undefined)).toBeNull();
    });

    it('splits stretches longer than a day into whole days', () => {
        // Fri 10:00 → Sun 02:00 continuously
        const hours = googlePeriodsToOpenHours([{ open: { day: 5, hour: 10, minute: 0 }, close: { day: 0, hour: 2, minute: 0 } }])!;
        expect(hours.fri).toEqual({ isOpen: true, open: '10:00', close: '00:00' });
        expect(hours.sat).toEqual({ isOpen: true, open: '00:00', close: '00:00' });
        expect(hours.sun).toEqual({ isOpen: true, open: '00:00', close: '02:00' });
    });
});

describe('toCandidate', () => {
    it('maps every field we use', () => {
        expect(toCandidate(VIOLET_HOUR)).toMatchObject({
            provider: 'google',
            externalId: 'ChIJviolethour',
            name: 'The Violet Hour',
            address: '1520 N Damen Ave, Chicago, IL 60622, USA',
            latitude: 41.90865,
            longitude: -87.67765,
            phoneNumber: '(773) 252-1500',
            website: 'https://www.theviolethour.com/',
            rating: 4.6,
            reviewCount: 2140,
            avgCost: 3,
            businessStatus: 'OPERATIONAL',
            googleMapsUrl: 'https://maps.google.com/?cid=111',
            types: ['bar', 'point_of_interest', 'establishment'],
            summary: 'Upscale cocktail lounge with a hidden entrance.',
        });
    });

    it('leaves missing values as null instead of guessing', () => {
        expect(toCandidate(NO_HOURS)).toMatchObject({ openHours: null, avgCost: null, phoneNumber: null, website: null, businessStatus: null, summary: null });
    });

    it('maps closure statuses', () => {
        expect(toCandidate(TEMPORARILY_CLOSED)!.businessStatus).toBe('CLOSED_TEMPORARILY');
        expect(toCandidate(PERMANENTLY_CLOSED)!.businessStatus).toBe('CLOSED_PERMANENTLY');
    });

    it('drops places without a location', () => {
        expect(toCandidate({ id: 'x', displayName: { text: 'Nowhere' } })).toBeNull();
    });
});

describe('GooglePlacesProvider (wire format)', () => {
    const requests: { method?: string; url?: string; headers: http.IncomingHttpHeaders; body: string }[] = [];
    let reply: { status: number; body: unknown } = { status: 200, body: {} };
    let server: http.Server;
    let provider: GooglePlacesProvider;

    beforeAll(async () => {
        server = http.createServer((req, res) => {
            let body = '';
            req.on('data', c => (body += c));
            req.on('end', () => {
                requests.push({ method: req.method, url: req.url, headers: req.headers, body });
                res.writeHead(reply.status, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(reply.body));
            });
        });
        await new Promise<void>(r => server.listen(0, '127.0.0.1', () => r()));
        provider = new GooglePlacesProvider('test-key', `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`);
    });
    afterAll(() => new Promise<void>(r => server.close(() => r())));

    it('sends Text Search with key, field mask and a circular location bias', async () => {
        reply = { status: 200, body: { places: [VIOLET_HOUR, { id: 'no-location' }] } };
        const results = await provider.search('The Violet Hour', { center: { lat: 41.9, lng: -87.68 }, radiusMeters: 500 });

        const req = requests.at(-1)!;
        expect(req.method).toBe('POST');
        expect(req.url).toBe('/v1/places:searchText');
        expect(req.headers['x-goog-api-key']).toBe('test-key');
        expect(req.headers['x-goog-fieldmask']).toBe(SEARCH_FIELD_MASK);
        expect(SEARCH_FIELD_MASK.split(',').every(f => f.startsWith('places.'))).toBe(true);
        expect(JSON.parse(req.body)).toMatchObject({
            textQuery: 'The Violet Hour',
            pageSize: 5,
            locationBias: { circle: { center: { latitude: 41.9, longitude: -87.68 }, radius: 500 } },
        });
        expect(results.map(r => r.externalId)).toEqual(['ChIJviolethour']);
    });

    it('fetches details by id with the unprefixed field mask', async () => {
        reply = { status: 200, body: VIOLET_HOUR };
        const place = await provider.getPlace('ChIJviolethour');
        const req = requests.at(-1)!;
        expect(req.method).toBe('GET');
        expect(req.url).toMatch(/^\/v1\/places\/ChIJviolethour\?/);
        expect(req.headers['x-goog-fieldmask']).toBe(DETAILS_FIELD_MASK);
        expect(place.name).toBe('The Violet Hour');
    });

    it('turns a rejected key into an actionable error', async () => {
        reply = { status: 403, body: { error: { code: 403, message: 'API key not valid.', status: 'PERMISSION_DENIED' } } };
        const err = await provider.search('x').catch(e => e);
        expect(err).toBeInstanceOf(HttpError);
        expect(err.status).toBe(502);
        expect(err.message).toMatch(/rejected the API key: API key not valid\..*Places API \(New\)/);
    });

    it('reports a deleted place as 404', async () => {
        reply = { status: 404, body: { error: { code: 404, message: 'Not found', status: 'NOT_FOUND' } } };
        const err = await provider.getPlace('gone').catch(e => e);
        expect(err.status).toBe(404);
    });
});
