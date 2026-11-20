import type {
    Category,
    CreateFromPlaceInput,
    EnrichResult,
    LatLng,
    PlacesStatus,
    ScoredCandidate,
    CategoryCreateInput,
    CategoryUpdateInput,
    ImportResult,
    Location,
    LocationCreateInput,
    LocationUpdateInput,
    PlanRequestInput,
    PlanResponse,
    Tag,
    TagCreateInput,
    TrainSnapshot,
    TransitRoute,
} from '@cta/shared';
import { request } from './http';

export type { Category, Location, Tag };

/** Typed client for the v1 API. Every call throws `ApiError` on failure. */
export const api = {
    locations: {
        /** `includeUnconfirmed` = admin view (also returns locations pending review). */
        list: (includeUnconfirmed = false) =>
            request<Location[]>('GET', `/locations${includeUnconfirmed ? '?all=true' : ''}`),
        get: (id: number) => request<Location>('GET', `/locations/${id}`),
        create: (data: LocationCreateInput) => request<Location>('POST', '/locations', data),
        /** Partial update: only the fields you pass are changed. */
        update: (id: number, data: LocationUpdateInput) => request<Location>('PATCH', `/locations/${id}`, data),
        remove: (id: number) => request<void>('DELETE', `/locations/${id}`),
        /** Match to Google (or refresh if already matched). */
        enrich: (id: number) => request<EnrichResult>('POST', `/locations/${id}/enrich`),
        /** Link to a specific Google place. */
        match: (id: number, externalId: string) => request<EnrichResult>('POST', `/locations/${id}/match`, { externalId }),
        /** "Not on Google" — stop suggesting matches. */
        ignoreMatch: (id: number) => request<EnrichResult>('POST', `/locations/${id}/match`, { ignore: true }),
        createFromPlace: (input: CreateFromPlaceInput) => request<EnrichResult>('POST', '/locations/from-place', input),
    },

    places: {
        status: () => request<PlacesStatus>('GET', '/places/status'),
        search: (q: string, near?: LatLng) => {
            const params = new URLSearchParams({ q });
            if (near) {
                params.set('lat', String(near.lat));
                params.set('lng', String(near.lng));
            }
            return request<ScoredCandidate[]>('GET', `/places/search?${params}`);
        },
    },

    categories: {
        list: () => request<Category[]>('GET', '/categories'),
        create: (data: CategoryCreateInput) => request<Category>('POST', '/categories', data),
        update: (id: number, data: CategoryUpdateInput) => request<Category>('PATCH', `/categories/${id}`, data),
        remove: (id: number) => request<void>('DELETE', `/categories/${id}`),
    },

    tags: {
        list: () => request<Tag[]>('GET', '/tags'),
        create: (data: TagCreateInput) => request<Tag>('POST', '/tags', data),
        rename: (id: number, name: string) => request<Tag>('PATCH', `/tags/${id}`, { name }),
        remove: (id: number) => request<void>('DELETE', `/tags/${id}`),
        addCategory: (id: number, categoryId: number) => request<Tag>('POST', `/tags/${id}/categories`, { categoryId }),
        removeCategory: (id: number, categoryId: number) => request<Tag>('DELETE', `/tags/${id}/categories/${categoryId}`),
    },

    plan: (criteria: PlanRequestInput) => request<PlanResponse>('POST', '/plan', criteria),

    importKml: (file: File) => {
        const form = new FormData();
        form.append('file', file);
        return request<ImportResult>('POST', '/import', form);
    },

    transit: {
        trains: () => request<TrainSnapshot>('GET', '/trains'),
        routes: () => request<TransitRoute[]>('GET', '/gtfs/routes'),
    },
};
