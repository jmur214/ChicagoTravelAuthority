import type { LatLng, PlaceCandidate } from '@cta/shared';

export interface SearchBias {
    center: LatLng;
    radiusMeters: number;
}

/** A source of place data. Google today; the interface keeps the rest of the pipeline provider-agnostic. */
export interface PlacesProvider {
    readonly name: 'google';
    /** Up to ~5 candidates for a free-text query, optionally biased toward a point. */
    search(query: string, bias?: SearchBias): Promise<PlaceCandidate[]>;
    /** Fresh details for a known place. */
    getPlace(externalId: string): Promise<PlaceCandidate>;
}
