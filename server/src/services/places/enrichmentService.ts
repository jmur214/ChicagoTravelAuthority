import { Prisma } from '@prisma/client';
import {
    CHICAGO_CENTER,
    ENRICHABLE_FIELDS,
    type EnrichableField,
    type EnrichResult,
    type FieldChange,
    type FieldSources,
    type LatLng,
    type MatchStatus,
    type PlaceCandidate,
    type ScoredCandidate,
} from '@cta/shared';
import { HttpError } from '../../lib/httpError';
import { deepEqual as same } from '../../lib/deepEqual';
import { prisma } from '../../lib/prisma';
import { locationInclude } from '../locationService';
import { decideMatch, rankCandidates, scoreCandidate } from './matching';
import type { PlacesProvider } from './provider';

/** How far from a location's saved coordinates to look for its listing. */
export const MATCH_RADIUS_METERS = 500;
/** Free-text searches (adding a new place) cover the whole city. */
const CITY_RADIUS_METERS = 30_000;

type LocationRow = Prisma.LocationGetPayload<{ include: typeof locationInclude }>;

const toJson = (v: unknown) => (v === null || v === undefined ? Prisma.DbNull : (v as Prisma.InputJsonValue));

const candidateValues = (c: PlaceCandidate): Record<EnrichableField, unknown> => ({
    address: c.address,
    phoneNumber: c.phoneNumber,
    website: c.website,
    openHours: c.openHours,
    rating: c.rating,
    reviewCount: c.reviewCount,
    avgCost: c.avgCost,
    description: c.summary,
    latitude: c.latitude,
    longitude: c.longitude,
    businessStatus: c.businessStatus,
    googleMapsUrl: c.googleMapsUrl,
});

/**
 * Decide which fields a provider candidate should change. Pure, so the rules are easy to test:
 *  - `manual` values are never touched
 *  - provider values replace google/estimate/kml/unknown-provenance values
 *  - when the provider has no value, previously provider-sourced or estimated values are cleared
 *    (e.g. guessed hours), but values of unknown origin are kept
 *  - descriptions are only filled when empty or previously provider-written; your own notes stay
 */
export function planChanges(
    current: Record<string, unknown> & { fieldSources?: unknown },
    candidate: PlaceCandidate,
    at: string,
): { changes: FieldChange[]; data: Partial<Record<EnrichableField, unknown>>; fieldSources: FieldSources } {
    const sources: FieldSources = { ...((current.fieldSources as FieldSources | null) ?? {}) };
    const incoming = candidateValues(candidate);
    const changes: FieldChange[] = [];
    const data: Partial<Record<EnrichableField, unknown>> = {};

    for (const field of ENRICHABLE_FIELDS) {
        const source = sources[field]?.source;
        if (source === 'manual') continue;

        const from = current[field] ?? null;
        const to = incoming[field] ?? null;
        const replaceable = source === 'google' || source === 'estimate';

        if (field === 'description' && from && !replaceable) continue;
        if (to === null && !replaceable) continue;
        if (same(from, to)) {
            if (to !== null) sources[field] = { source: 'google', at };
            continue;
        }

        data[field] = to;
        changes.push({ field, from, to });
        if (to === null) delete sources[field];
        else sources[field] = { source: 'google', at };
    }

    return { changes, data, fieldSources: sources };
}

export class EnrichmentService {
    constructor(private readonly provider: PlacesProvider | null) {}

    get configured() {
        return this.provider !== null;
    }

    private requireProvider(): PlacesProvider {
        if (!this.provider) {
            throw new HttpError(503, 'NOT_CONFIGURED', 'Google Places is not set up. Add GOOGLE_PLACES_KEY to server/.env and restart the server.');
        }
        return this.provider;
    }

    /** Free-text search, ranked by similarity to the query (and distance, if `near` is given). */
    async search(query: string, near?: LatLng): Promise<ScoredCandidate[]> {
        const provider = this.requireProvider();
        const results = await provider.search(query, {
            center: near ?? CHICAGO_CENTER,
            radiusMeters: near ? 2_000 : CITY_RADIUS_METERS,
        });
        return rankCandidates(results.map(c => scoreCandidate({ name: query, latitude: near?.lat, longitude: near?.lng }, c)));
    }

    /**
     * Match (or refresh) one location:
     *  - already matched → refresh from its linked place
     *  - otherwise search near its coordinates; apply a confident match, else queue for review
     */
    async enrich(id: number): Promise<EnrichResult> {
        const provider = this.requireProvider();
        const location = await this.load(id);

        if (location.matchStatus === 'ignored') return this.result(location, 'ignored');

        if (location.matchStatus === 'matched' && location.googlePlaceId) {
            try {
                return await this.apply(location, await provider.getPlace(location.googlePlaceId));
            } catch (err) {
                // The listing disappeared — fall through and look for it again.
                if (!(err instanceof HttpError && err.status === 404)) throw err;
            }
        }

        const found = await provider.search(location.name, {
            center: { lat: location.latitude, lng: location.longitude },
            radiusMeters: MATCH_RADIUS_METERS,
        });
        const decision = decideMatch(found.map(c => scoreCandidate(location, c)));

        if (decision.kind === 'auto') return this.apply(location, decision.best);
        return this.queue(location, decision.kind === 'review' ? 'needs_review' : 'no_match', decision.candidates);
    }

    /** Curator picked a specific place (from review or a manual search). */
    async match(id: number, externalId: string): Promise<EnrichResult> {
        const provider = this.requireProvider();
        const location = await this.load(id);
        return this.apply(location, await provider.getPlace(externalId));
    }

    /** Curator says this place has no listing; stop suggesting matches. */
    async ignore(id: number): Promise<EnrichResult> {
        await prisma.location.update({
            where: { id },
            data: { matchStatus: 'ignored', matchCandidates: Prisma.DbNull },
        });
        return this.result(await this.load(id), 'ignored');
    }

    /** Create a new location straight from a provider place. */
    async createFromPlace(input: { externalId: string; name?: string; isConfirmed?: boolean }): Promise<EnrichResult> {
        const provider = this.requireProvider();
        const existing = await prisma.location.findFirst({ where: { googlePlaceId: input.externalId }, select: { name: true } });
        if (existing) throw new HttpError(409, 'CONFLICT', `Already in your places as "${existing.name}"`);

        const place = await provider.getPlace(input.externalId);
        const created = await prisma.location.create({
            data: {
                name: input.name ?? place.name,
                latitude: place.latitude,
                longitude: place.longitude,
                isConfirmed: input.isConfirmed ?? false,
            },
            include: locationInclude,
        });
        return this.apply(created, place);
    }

    private async apply(location: LocationRow, place: PlaceCandidate): Promise<EnrichResult> {
        const at = new Date().toISOString();
        const { changes, data, fieldSources } = planChanges(location as unknown as Record<string, unknown>, place, at);
        const metadata = { ...((location.metadata as Record<string, unknown> | null) ?? {}), placeTypes: place.types };

        const updated = await prisma.location.update({
            where: { id: location.id },
            data: {
                ...data,
                ...('openHours' in data ? { openHours: toJson(data.openHours) } : {}),
                googlePlaceId: place.externalId,
                matchStatus: 'matched',
                matchCandidates: Prisma.DbNull,
                enrichedAt: new Date(at),
                fieldSources: fieldSources as Prisma.InputJsonValue,
                metadata: metadata as Prisma.InputJsonValue,
            } as Prisma.LocationUpdateInput,
            include: locationInclude,
        });
        return this.result(updated, 'matched', changes);
    }

    private async queue(location: LocationRow, status: MatchStatus, candidates: ScoredCandidate[]): Promise<EnrichResult> {
        const updated = await prisma.location.update({
            where: { id: location.id },
            data: { matchStatus: status, matchCandidates: toJson(candidates) },
            include: locationInclude,
        });
        return this.result(updated, status, [], candidates);
    }

    private load(id: number) {
        return prisma.location.findUniqueOrThrow({ where: { id }, include: locationInclude });
    }

    private result(location: LocationRow, status: MatchStatus, changes: FieldChange[] = [], candidates: ScoredCandidate[] = []): EnrichResult {
        return { status, location: location as unknown as EnrichResult['location'], changes, candidates };
    }
}
