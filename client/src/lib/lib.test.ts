import { describe, expect, it } from 'vitest';
import type { Category, Location, Tag } from '@cta/shared';
import { suggestedCategories, rootCategories, visibleCategories } from './categories';
import { priceLabel } from './datetime';
import { filterLocations } from './filters';
import { calculateHeatmaps, HEATMAP_COLORS } from './heatmap';
import { getMarkerConfig, markerHtml } from './markers';

const cat = (id: number, name: string, extra: Partial<Category> = {}): Category => ({
    id, name, parentId: null, color: null, shape: null, isSingleSelect: false, ...extra,
});
const tag = (id: number, name: string, categories?: Category[]): Tag => ({ id, name, categories });

const loc = (overrides: Partial<Location> = {}): Location => ({
    id: 1, name: 'Spot', description: null, latitude: 41.89, longitude: -87.63, address: null, googlePlaceId: null,
    phoneNumber: null, metadata: null, avgCost: 2, avgStayMinutes: 90, openHours: null, website: null, menuUrl: null,
    eventsInfo: null, rating: null, reviewCount: null, isConfirmed: true, verifiedVibe: false, userVerifiedCount: 0,
    businessStatus: null, googleMapsUrl: null, matchStatus: 'unmatched', matchCandidates: null, enrichedAt: null, fieldSources: null,
    createdAt: '', updatedAt: '', tags: [], categories: [], ...overrides,
});

const withTags = (...names: string[]) => names.map((n, i) => ({ tag: tag(i + 1, n) }));

describe('categories', () => {
    const folder = cat(1, 'Folder');
    const food = cat(2, 'Food');
    const pizza = cat(3, 'Pizza', { parentId: 2 });

    it('hides the internal Folder category', () => {
        expect(visibleCategories([folder, food])).toEqual([food]);
        expect(rootCategories([folder, food, pizza])).toEqual([food]);
    });

    it('suggests categories implied by tags that the location lacks', () => {
        const allTags = [tag(10, 'Deep Dish', [food, pizza, folder])];
        const location = loc({ tags: [{ tag: tag(10, 'Deep Dish') }], categories: [food] });
        expect(suggestedCategories(location, allTags)).toEqual([pizza]);
    });
});

describe('filterLocations', () => {
    const a = loc({ id: 1, name: 'Violet Hour', categories: [cat(5, 'Nightlife')] });
    const b = loc({ id: 2, name: 'Lou Malnati', description: 'Deep dish pizza', tags: withTags('Pizza') });

    it('filters by category or tag name', () => {
        expect(filterLocations([a, b], { category: 'Nightlife', search: '' })).toEqual([a]);
        expect(filterLocations([a, b], { category: 'Pizza', search: '' })).toEqual([b]);
    });

    it('searches name and description case-insensitively', () => {
        expect(filterLocations([a, b], { search: 'DEEP' })).toEqual([b]);
        expect(filterLocations([a, b], { search: '  ' })).toEqual([a, b]);
    });
});

describe('heatmap', () => {
    const night = new Date(2026, 10, 17, 22, 0);
    const day = new Date(2026, 10, 17, 11, 0);
    const bars = [1, 2].map(id => loc({ id, tags: withTags('Bar') }));

    it('highlights nightlife clusters at night', () => {
        const [cluster] = calculateHeatmaps(bars, night);
        expect(cluster).toMatchObject({ color: HEATMAP_COLORS.night, intensity: 1 });
    });

    it('downweights nightlife during the day below the display threshold', () => {
        expect(calculateHeatmaps(bars, day)).toEqual([]);
    });

    it('returns nothing for no locations', () => {
        expect(calculateHeatmaps([], night)).toEqual([]);
    });
});

describe('markers', () => {
    it('uses the first category style when present', () => {
        const config = getMarkerConfig(loc({ categories: [cat(1, 'Food', { color: '#FF0099', shape: 'star' })], tags: withTags('Bar') }));
        expect(config).toMatchObject({ color: '#FF0099', shape: 'star' });
    });

    it('falls back to tag-based styling, then a default', () => {
        expect(getMarkerConfig(loc({ tags: withTags('Speakeasy') })).shape).toBe('diamond');
        expect(getMarkerConfig(loc()).color).toBe('#ffffff');
    });

    it('renders a ring as a hollow circle', () => {
        const html = markerHtml({ color: '#3BFFFF', shape: 'ring', pulseClass: '', size: 28 });
        expect(html).toContain('background-color: transparent');
        expect(html).toContain('border-radius: 50%');
    });
});

describe('datetime', () => {
    it('labels price levels', () => {
        expect(priceLabel(3)).toBe('$$$');
        expect(priceLabel(null)).toBe('—');
    });
});
