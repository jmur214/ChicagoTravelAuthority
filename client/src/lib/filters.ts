import type { Location } from '@cta/shared';

export interface Filters {
    /** Category or tag name; undefined = all */
    category?: string;
    search: string;
}

export const EMPTY_FILTERS: Filters = { search: '' };

/** Apply the map's category/tag and free-text filters. */
export function filterLocations(locations: Location[], { category, search }: Filters): Location[] {
    const q = search.trim().toLowerCase();
    return locations.filter(l => {
        if (category && !l.categories.some(c => c.name === category) && !l.tags.some(t => t.tag.name === category)) {
            return false;
        }
        if (q && !l.name.toLowerCase().includes(q) && !l.description?.toLowerCase().includes(q)) {
            return false;
        }
        return true;
    });
}
