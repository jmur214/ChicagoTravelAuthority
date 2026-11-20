/**
 * Rough "energy" of a place on the planner's 1 (chill) – 5 (chaos) scale,
 * inferred from its tag and category names. Tags are free-form (often KML
 * folder names), so this is a keyword heuristic: whole-word, case-insensitive,
 * plurals allowed. Extend the table as your tagging evolves.
 */
export const ENERGY_KEYWORDS: Record<1 | 2 | 3 | 4 | 5, string[]> = {
    5: ['nightclub', 'night club', 'club', 'dance', 'dancing', 'rave', 'high energy', 'party', 'edm', 'bottle service'],
    4: ['nightlife', 'live music', 'concert', 'late night', 'karaoke', 'sports bar', 'sports', 'comedy', 'show',
        'arcade', 'barcade', 'pinball', 'beer hall', 'blues', 'baseball', 'stadium'],
    3: ['bar', 'pub', 'tavern', 'dive', 'cocktail', 'brewery', 'beer', 'restaurant', 'food', 'dinner', 'dining',
        'pizza', 'burger', 'taco', 'brunch', 'popular', 'trendy', 'jazz', 'food hall'],
    2: ['speakeasy', 'wine', 'lounge', 'rooftop', 'views', 'casual', 'shopping', 'shop', 'market', 'thrift',
        'sightseeing', 'landmark', 'tourist', 'architecture'],
    1: ['museum', 'park', 'garden', 'walk', 'coffee', 'cafe', 'tea', 'bookstore', 'library', 'nature', 'quiet',
        'chill', 'art', 'gallery', 'zoo', 'aquarium', 'beach', 'culture', 'science'],
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const MATCHERS: { level: number; re: RegExp }[] = Object.entries(ENERGY_KEYWORDS).flatMap(([level, words]) =>
    words.map(w => ({ level: Number(level), re: new RegExp(`\\b${escape(w)}(e?s)?\\b`, 'i') })),
);

/** Average level of all matched labels, or null if nothing matched. */
export function estimateEnergy(labels: string[]): number | null {
    const levels: number[] = [];
    for (const label of labels) {
        for (const { level, re } of MATCHERS) {
            if (re.test(label)) levels.push(level);
        }
    }
    return levels.length ? levels.reduce((a, b) => a + b, 0) / levels.length : null;
}
