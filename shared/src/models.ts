import type { OpenHours } from './openHours';
import type { MarkerShape, TransportMode } from './schemas';

// ---------------------------------------------------------------------------
// Response shapes returned by the API (JSON). Dates are ISO-8601 strings.
// ---------------------------------------------------------------------------

/** Category created automatically for raw KML folder names; hidden from end users. */
export const FOLDER_CATEGORY_NAME = 'Folder';

export interface Category {
    id: number;
    name: string;
    parentId: number | null;
    color: string | null;
    shape: MarkerShape | null;
    isSingleSelect: boolean;
    /** Present on GET /categories. */
    tags?: Tag[];
}

export interface Tag {
    id: number;
    name: string;
    /** Present on GET /tags and tag mutations. */
    categories?: Category[];
}

export interface LocationTag {
    tag: Tag;
}

export interface LocationMetadata {
    imageUrl?: string;
    originalFolders?: string[];
    unverifiedTags?: string[];
    [key: string]: unknown;
}

// --- Place data enrichment -----------------------------------------------------

export type BusinessStatus = 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY' | 'FUTURE_OPENING';

/**
 * unmatched    — never checked against the places provider
 * matched      — linked to a provider place; data comes from it
 * needs_review — plausible candidates found, but not certain enough to apply automatically
 * no_match     — nothing plausible found
 * ignored      — curator said this place has no provider listing; don't ask again
 */
export type MatchStatus = 'unmatched' | 'matched' | 'needs_review' | 'no_match' | 'ignored';
export type MatchConfidence = 'high' | 'medium' | 'low';

/** A place as returned by the provider (Google Places), normalized to our fields. */
export interface PlaceCandidate {
    provider: 'google';
    externalId: string;
    name: string;
    address: string | null;
    latitude: number;
    longitude: number;
    /** null = provider has no hours */
    openHours: OpenHours | null;
    phoneNumber: string | null;
    website: string | null;
    rating: number | null;
    reviewCount: number | null;
    /** 1–4, mapped from the provider's price level */
    avgCost: number | null;
    businessStatus: BusinessStatus | null;
    googleMapsUrl: string | null;
    types: string[];
    /** Provider-written summary, if any */
    summary: string | null;
}

export interface ScoredCandidate extends PlaceCandidate {
    /** From the location being matched; null when searching without one */
    distanceMeters: number | null;
    /** 0–1 */
    nameScore: number;
    confidence: MatchConfidence;
}

/** Fields the enrichment pipeline may fill in. */
export const ENRICHABLE_FIELDS = [
    'address', 'phoneNumber', 'website', 'openHours', 'rating', 'reviewCount', 'avgCost',
    'description', 'latitude', 'longitude', 'businessStatus', 'googleMapsUrl',
] as const;
export type EnrichableField = (typeof ENRICHABLE_FIELDS)[number];

/**
 * Where a field's value came from. Enrichment never overwrites `manual` values;
 * `estimate` values (e.g. guessed hours) are replaced whenever real data exists.
 */
export type FieldSource = 'google' | 'manual' | 'kml' | 'estimate';
export type FieldSources = Partial<Record<EnrichableField, { source: FieldSource; at: string }>>;

export interface FieldChange {
    field: EnrichableField;
    from: unknown;
    to: unknown;
}

export interface EnrichResult {
    status: MatchStatus;
    location: Location;
    /** Fields that changed in this run */
    changes: FieldChange[];
    /** Present when status is needs_review / no_match */
    candidates: ScoredCandidate[];
}

export interface PlacesStatus {
    provider: 'google';
    configured: boolean;
}

export interface Location {
    id: number;
    name: string;
    description: string | null;
    latitude: number;
    longitude: number;
    address: string | null;
    googlePlaceId: string | null;
    phoneNumber: string | null;
    metadata: LocationMetadata | null;
    /** 1 = $, 4 = $$$$ */
    avgCost: number | null;
    avgStayMinutes: number;
    openHours: OpenHours | null;
    website: string | null;
    menuUrl: string | null;
    eventsInfo: string | null;
    rating: number | null;
    reviewCount: number | null;
    isConfirmed: boolean;
    verifiedVibe: boolean;
    userVerifiedCount: number;
    businessStatus: BusinessStatus | null;
    googleMapsUrl: string | null;
    matchStatus: MatchStatus;
    /** Candidates awaiting review (needs_review / no_match) */
    matchCandidates: ScoredCandidate[] | null;
    /** Last time data was pulled from the places provider */
    enrichedAt: string | null;
    fieldSources: FieldSources | null;
    createdAt: string;
    updatedAt: string;
    tags: LocationTag[];
    categories: Category[];
}

export interface ItineraryItem {
    order: number;
    locationId: number;
    name: string;
    description: string;
    arrivalTime: string;
    departureTime: string;
    reason: string;
    coords: { lat: number; lng: number };
    /** Minutes to travel here from the previous stop (or the start point). */
    travelTimeMinutes: number;
    travelMode: TransportMode;
    /** 10–99 for planner picks; 0 for stops added by hand. */
    matchScore: number;
    /** Whether the place is open when you'd arrive; null if its hours are unknown. */
    isOpenOnArrival: boolean | null;
}

export interface PlanResponse {
    items: ItineraryItem[];
    /** The resolved inputs, so clients can re-time the plan after edits. */
    startTime: string;
    startLocation: { lat: number; lng: number };
    transportMode: TransportMode;
}

export interface ImportResult {
    total: number;
    imported: number;
    updated: number;
    errors: number;
}

export interface Train {
    /** CTA run number */
    id: string;
    route: string;
    lat: number;
    lon: number;
    heading: number;
    destination: string;
    lastUpdate: string;
    isMock?: boolean;
}

export interface TrainSnapshot {
    generatedAt: string;
    trains: Train[];
}

export interface TransitRoute {
    id: string;
    name: string;
    color: string;
    /** Polylines as [lat, lon] pairs. */
    shapes: [number, number][][];
}

// --- Errors ------------------------------------------------------------------

export type ApiErrorCode = 'VALIDATION_ERROR' | 'NOT_FOUND' | 'CONFLICT' | 'BAD_REQUEST' | 'NOT_CONFIGURED' | 'UPSTREAM_ERROR' | 'INTERNAL_ERROR';

/** Every non-2xx response has this body. */
export interface ApiErrorBody {
    error: {
        code: ApiErrorCode;
        message: string;
        details?: unknown;
    };
}
