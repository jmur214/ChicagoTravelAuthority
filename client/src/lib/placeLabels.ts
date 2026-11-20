import type { BusinessStatus, EnrichableField, FieldSources, MatchConfidence } from '@cta/shared';

export const FIELD_LABELS: Record<EnrichableField, string> = {
    address: 'address',
    phoneNumber: 'phone',
    website: 'website',
    openHours: 'hours',
    rating: 'rating',
    reviewCount: 'review count',
    avgCost: 'price',
    description: 'description',
    latitude: 'location',
    longitude: 'location',
    businessStatus: 'open/closed status',
    googleMapsUrl: 'Google Maps link',
};

/** "hours, website, phone" — de-duplicated (lat/lng both read "location"). */
export const describeFields = (fields: EnrichableField[]) => [...new Set(fields.map(f => FIELD_LABELS[f]))].join(', ');

export const businessStatusLabel = (status: BusinessStatus | null | undefined): string | null => {
    switch (status) {
        case 'CLOSED_PERMANENTLY': return 'Permanently closed';
        case 'CLOSED_TEMPORARILY': return 'Temporarily closed';
        case 'FUTURE_OPENING': return 'Opening soon';
        default: return null;
    }
};

export const confidenceStyle: Record<MatchConfidence, string> = {
    high: 'text-green-400 border-green-500/40 bg-green-900/20',
    medium: 'text-yellow-400 border-yellow-500/40 bg-yellow-900/20',
    low: 'text-gray-400 border-white/10 bg-white/5',
};

export const formatDistance = (meters: number | null) =>
    meters === null ? '' : meters < 1000 ? `${meters} m away` : `${(meters / 1000).toFixed(1)} km away`;

export const formatDate = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

/** Short provenance hint for a form field: "from Google · Nov 20, 2026" / "edited by you". */
export function sourceHint(sources: FieldSources | null | undefined, field: EnrichableField): string | null {
    const s = sources?.[field];
    if (!s) return null;
    switch (s.source) {
        case 'google': return `from Google · ${formatDate(s.at)}`;
        case 'manual': return 'edited by you';
        case 'kml': return 'from your KML import';
        case 'estimate': return 'estimate — will be replaced by real data';
    }
}
