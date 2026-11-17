import { FOLDER_CATEGORY_NAME, type Category, type Location } from '@cta/shared';

/** Hide the internal "Folder" category (raw KML folder names) from user-facing lists. */
export const visibleCategories = (categories: Category[]) => categories.filter(c => c.name !== FOLDER_CATEGORY_NAME);

export const rootCategories = (categories: Category[]) => visibleCategories(categories).filter(c => !c.parentId);

export const childCategories = (categories: Category[], parentId: number) => categories.filter(c => c.parentId === parentId);

/**
 * Categories implied by a location's tags (tag -> category links) that the
 * location doesn't have yet. Used for one-click suggestions in the admin.
 */
export function suggestedCategories(location: Location, allTags: { id: number; categories?: Category[] }[]): Category[] {
    const current = new Set(location.categories.map(c => c.id));
    const tagCategories = new Map(allTags.map(t => [t.id, t.categories ?? []]));
    const suggestions = new Map<number, Category>();

    for (const { tag } of location.tags) {
        // Prefer the embedded tag categories; fall back to the global tag list.
        for (const c of tag.categories ?? tagCategories.get(tag.id) ?? []) {
            if (c.name !== FOLDER_CATEGORY_NAME && !current.has(c.id)) suggestions.set(c.id, c);
        }
    }
    return [...suggestions.values()];
}
