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

export type ApiErrorCode = 'VALIDATION_ERROR' | 'NOT_FOUND' | 'CONFLICT' | 'BAD_REQUEST' | 'INTERNAL_ERROR';

/** Every non-2xx response has this body. */
export interface ApiErrorBody {
    error: {
        code: ApiErrorCode;
        message: string;
        details?: unknown;
    };
}
