import axios, { AxiosError } from 'axios';
import {
    CLOSED_DAY,
    DAY_KEYS,
    type BusinessStatus,
    type DayKey,
    type OpenHours,
    type PlaceCandidate,
    type TimeWindow,
} from '@cta/shared';
import { HttpError } from '../../lib/httpError';
import type { PlacesProvider, SearchBias } from './provider';

/**
 * Google Places API (New) — https://places.googleapis.com/v1
 * Request/response shapes follow the API's discovery document (places v1).
 * The legacy Places API (maps.googleapis.com/maps/api/place) can't be enabled on new projects.
 */

// --- Raw API shapes (only the fields we request) ------------------------------

interface GPoint { day?: number; hour?: number; minute?: number; truncated?: boolean }
interface GPeriod { open?: GPoint; close?: GPoint }
export interface GPlace {
    id: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
    regularOpeningHours?: { periods?: GPeriod[] };
    nationalPhoneNumber?: string;
    websiteUri?: string;
    rating?: number;
    userRatingCount?: number;
    priceLevel?: string;
    businessStatus?: string;
    googleMapsUri?: string;
    types?: string[];
    editorialSummary?: { text?: string };
}

const PLACE_FIELDS = [
    'id', 'displayName', 'formattedAddress', 'location', 'regularOpeningHours', 'nationalPhoneNumber',
    'websiteUri', 'rating', 'userRatingCount', 'priceLevel', 'businessStatus', 'googleMapsUri', 'types',
    'editorialSummary',
];
/** Text Search nests fields under `places.` */
export const SEARCH_FIELD_MASK = PLACE_FIELDS.map(f => `places.${f}`).join(',');
export const DETAILS_FIELD_MASK = PLACE_FIELDS.join(',');

/** Google day numbering: 0 = Sunday. */
const GOOGLE_DAY_TO_KEY: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MINUTES_PER_DAY = 24 * 60;
const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (minutesOfDay: number) => `${pad(Math.floor(minutesOfDay / 60))}:${pad(minutesOfDay % 60)}`;
const weekMinute = (p: GPoint) => (p.day ?? 0) * MINUTES_PER_DAY + (p.hour ?? 0) * 60 + (p.minute ?? 0);

/**
 * Convert Google's weekly periods to our per-day windows.
 * - no `periods` field    → null (hours unknown)
 * - empty `periods` array → closed every day (Google: "never open", e.g. renovations)
 * - one period with no `close` → open 24/7
 * - a period ending the next day stays on its opening day (our "close ≤ open" = past midnight)
 * - a period longer than a day is split into whole-day windows
 * - several periods on one day become `additional` windows (lunch + dinner)
 */
export function googlePeriodsToOpenHours(periods: GPeriod[] | undefined): OpenHours | null {
    if (!periods) return null;

    if (periods.length === 1 && periods[0].open && !periods[0].close) {
        return Object.fromEntries(DAY_KEYS.map(d => [d, { isOpen: true, open: '00:00', close: '00:00' }])) as OpenHours;
    }

    const windowsByDay = new Map<DayKey, TimeWindow[]>();
    const add = (dayIndex: number, window: TimeWindow) => {
        const key = GOOGLE_DAY_TO_KEY[dayIndex % 7];
        windowsByDay.set(key, [...(windowsByDay.get(key) ?? []), window]);
    };

    for (const { open, close } of periods) {
        if (!open || !close) continue;
        const start = weekMinute(open);
        let duration = weekMinute(close) - start;
        if (duration <= 0) duration += MINUTES_PER_WEEK; // wraps past Saturday night
        const startDay = Math.floor(start / MINUTES_PER_DAY);
        const startTime = start % MINUTES_PER_DAY;

        if (duration <= MINUTES_PER_DAY) {
            add(startDay, { open: hhmm(startTime), close: hhmm((startTime + duration) % MINUTES_PER_DAY) });
            continue;
        }
        // Multi-day stretch: until midnight, whole days, then the remainder.
        add(startDay, { open: hhmm(startTime), close: '00:00' });
        let remaining = duration - (MINUTES_PER_DAY - startTime);
        let day = startDay + 1;
        while (remaining >= MINUTES_PER_DAY) {
            add(day++, { open: '00:00', close: '00:00' });
            remaining -= MINUTES_PER_DAY;
        }
        if (remaining > 0) add(day, { open: '00:00', close: hhmm(remaining) });
    }

    return Object.fromEntries(
        DAY_KEYS.map(d => {
            const windows = (windowsByDay.get(d) ?? []).sort((a, b) => a.open.localeCompare(b.open));
            if (!windows.length) return [d, { ...CLOSED_DAY }];
            const [first, ...rest] = windows;
            return [d, { isOpen: true, ...first, ...(rest.length ? { additional: rest } : {}) }];
        }),
    ) as OpenHours;
}

const PRICE_TO_COST: Record<string, number> = {
    PRICE_LEVEL_FREE: 1,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

const BUSINESS_STATUSES: BusinessStatus[] = ['OPERATIONAL', 'CLOSED_TEMPORARILY', 'CLOSED_PERMANENTLY', 'FUTURE_OPENING'];

export function toCandidate(p: GPlace): PlaceCandidate | null {
    const lat = p.location?.latitude;
    const lng = p.location?.longitude;
    if (!p.id || lat === undefined || lng === undefined) return null;
    return {
        provider: 'google',
        externalId: p.id,
        name: p.displayName?.text ?? '',
        address: p.formattedAddress ?? null,
        latitude: lat,
        longitude: lng,
        openHours: googlePeriodsToOpenHours(p.regularOpeningHours?.periods),
        phoneNumber: p.nationalPhoneNumber ?? null,
        website: p.websiteUri ?? null,
        rating: p.rating ?? null,
        reviewCount: p.userRatingCount ?? null,
        avgCost: (p.priceLevel && PRICE_TO_COST[p.priceLevel]) || null,
        businessStatus: BUSINESS_STATUSES.includes(p.businessStatus as BusinessStatus) ? (p.businessStatus as BusinessStatus) : null,
        googleMapsUrl: p.googleMapsUri ?? null,
        types: p.types ?? [],
        summary: p.editorialSummary?.text ?? null,
    };
}

/** Turn Google's error body into a message a curator can act on. */
function upstreamError(err: unknown): HttpError {
    if (err instanceof AxiosError) {
        const body = err.response?.data as { error?: { message?: string; status?: string } } | undefined;
        const message = body?.error?.message ?? err.message;
        const status = err.response?.status;
        if (status === 403 || status === 401) {
            return new HttpError(502, 'UPSTREAM_ERROR', `Google Places rejected the API key: ${message} (check that "Places API (New)" is enabled for the key's project)`);
        }
        if (status === 429) return new HttpError(502, 'UPSTREAM_ERROR', 'Google Places rate limit or quota reached — try again later.');
        return new HttpError(502, 'UPSTREAM_ERROR', `Google Places request failed${status ? ` (${status})` : ''}: ${message}`);
    }
    return new HttpError(502, 'UPSTREAM_ERROR', `Google Places request failed: ${String(err)}`);
}

export class GooglePlacesProvider implements PlacesProvider {
    readonly name = 'google' as const;

    constructor(
        private readonly apiKey: string,
        private readonly baseUrl = 'https://places.googleapis.com/v1',
    ) {}

    async search(query: string, bias?: SearchBias): Promise<PlaceCandidate[]> {
        try {
            const res = await axios.post<{ places?: GPlace[] }>(
                `${this.baseUrl}/places:searchText`,
                {
                    textQuery: query,
                    pageSize: 5,
                    languageCode: 'en',
                    regionCode: 'US',
                    ...(bias && {
                        locationBias: {
                            circle: { center: { latitude: bias.center.lat, longitude: bias.center.lng }, radius: bias.radiusMeters },
                        },
                    }),
                },
                { headers: this.headers(SEARCH_FIELD_MASK), timeout: 15_000 },
            );
            return (res.data.places ?? []).map(toCandidate).filter((c): c is PlaceCandidate => c !== null);
        } catch (err) {
            throw upstreamError(err);
        }
    }

    async getPlace(externalId: string): Promise<PlaceCandidate> {
        try {
            const res = await axios.get<GPlace>(`${this.baseUrl}/places/${encodeURIComponent(externalId)}`, {
                headers: this.headers(DETAILS_FIELD_MASK),
                params: { languageCode: 'en', regionCode: 'US' },
                timeout: 15_000,
            });
            const candidate = toCandidate(res.data);
            if (!candidate) throw new HttpError(502, 'UPSTREAM_ERROR', 'Google Places returned a place without a location');
            return candidate;
        } catch (err) {
            if (err instanceof HttpError) throw err;
            if (err instanceof AxiosError && err.response?.status === 404) {
                throw new HttpError(404, 'NOT_FOUND', 'That Google place no longer exists');
            }
            throw upstreamError(err);
        }
    }

    private headers(fieldMask: string) {
        return { 'X-Goog-Api-Key': this.apiKey, 'X-Goog-FieldMask': fieldMask, 'Content-Type': 'application/json' };
    }
}
