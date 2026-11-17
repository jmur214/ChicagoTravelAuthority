import type { Location } from '@cta/shared';

export interface HeatmapCluster {
    lat: number;
    lng: number;
    /** 0–1 relative to the busiest cell */
    intensity: number;
    color: string;
    /** meters */
    radius: number;
}

/** Grid cell size in degrees (~1.5 blocks). */
export const GRID_SIZE_DEG = 0.0035;
/** Cells scoring at or below this are not drawn. */
export const MIN_CELL_SCORE = 2;

const NIGHTLIFE_TAGS = ['Nightclub', 'Bar', 'Dance', 'High Energy', 'Drinks'];
const DAYTIME_TAGS = ['Cafe', 'Coffee', 'Park', 'Museum', 'Breakfast'];
const FOOD_TAGS = ['Restaurant', 'Dinner'];

export const HEATMAP_COLORS = {
    night: '#00F0FF',
    food: '#FF0099',
    day: '#FFD700',
    mixed: '#FFBF00',
} as const;

/** Evening hours, local time: 6pm–4am. */
export const isNightHour = (hour: number) => hour >= 18 || hour < 4;

type Kind = 'night' | 'day' | 'food';

/**
 * Point weights by time of day: what's "hot" right now counts 3x,
 * food is steady at 2x, and off-hours venues count half.
 */
function weigh(tags: string[], night: boolean): { kind: Kind; score: number } | { kind: null; score: number } {
    const isNightlife = tags.some(t => NIGHTLIFE_TAGS.includes(t));
    const isDaytime = tags.some(t => DAYTIME_TAGS.includes(t));
    const isFood = tags.some(t => FOOD_TAGS.includes(t));

    if (night) {
        if (isNightlife) return { kind: 'night', score: 3 };
        if (isFood) return { kind: 'food', score: 2 };
        if (isDaytime) return { kind: 'day', score: 0.5 };
    } else {
        if (isDaytime) return { kind: 'day', score: 3 };
        if (isFood) return { kind: 'food', score: 2 };
        if (isNightlife) return { kind: 'night', score: 0.5 };
    }
    return { kind: null, score: 1 };
}

/** Bucket locations into a grid and score each cell by time-of-day relevance. */
export function calculateHeatmaps(locations: Location[], now: Date = new Date()): HeatmapCluster[] {
    const night = isNightHour(now.getHours());
    const grid = new Map<string, { lat: number; lng: number; score: number; counts: Record<Kind, number> }>();

    for (const loc of locations) {
        const gx = Math.floor(loc.latitude / GRID_SIZE_DEG);
        const gy = Math.floor(loc.longitude / GRID_SIZE_DEG);
        const key = `${gx},${gy}`;
        let cell = grid.get(key);
        if (!cell) {
            cell = {
                lat: gx * GRID_SIZE_DEG + GRID_SIZE_DEG / 2,
                lng: gy * GRID_SIZE_DEG + GRID_SIZE_DEG / 2,
                score: 0,
                counts: { night: 0, day: 0, food: 0 },
            };
            grid.set(key, cell);
        }

        const { kind, score } = weigh(loc.tags.map(t => t.tag.name), night);
        if (kind) cell.counts[kind]++;
        cell.score += score;
    }

    const cells = [...grid.values()];
    const maxScore = Math.max(...cells.map(c => c.score), 1);

    return cells
        .filter(cell => cell.score > MIN_CELL_SCORE)
        .map(cell => {
            const { night: n, day: d, food: f } = cell.counts;
            const color =
                n > d && n > f ? HEATMAP_COLORS.night
                    : f > n && f > d ? HEATMAP_COLORS.food
                        : d > n ? HEATMAP_COLORS.day
                            : HEATMAP_COLORS.mixed;
            const intensity = Math.min(cell.score / maxScore, 1);
            return { lat: cell.lat, lng: cell.lng, intensity, color, radius: 300 + intensity * 500 };
        });
}
