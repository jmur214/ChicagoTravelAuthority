import {
    estimateEnergy,
    isOpenAt,
    MAX_WALK_KM,
    distanceKm,
    scheduleStops,
    travelMinutes,
    type ItineraryItem,
    type LatLng,
    type OpenHours,
    type TransportMode,
} from '@cta/shared';

/** Minimal view of a location the planner needs. Keeps this module DB-agnostic and unit-testable. */
export interface PlannerCandidate {
    id: number;
    name: string;
    description: string | null;
    latitude: number;
    longitude: number;
    avgCost: number | null;
    avgStayMinutes: number;
    openHours: OpenHours | null;
    tagNames: string[];
    categoryIds: number[];
    categoryNames: Map<number, string>;
}

export interface PlannerCriteria {
    startLocation: LatLng;
    startTime: Date;
    durationHours: number;
    vibes: string[];
    categoryIds: number[];
    transportMode: TransportMode;
    budget?: number;
    /** 1 (chill) – 5 (chaos) */
    energyLevel?: number;
    maxStops: number;
}

/** Score weights. Travel and matches dominate; budget and energy are strong preferences. */
export const SCORE = {
    perTravelMinute: -2,
    perMatch: 15,
    perBudgetStep: -20,
    perEnergyStep: -8,
} as const;

/**
 * Target energy for the n-th stop (0-based): the first stop warms up one level
 * below the requested energy, then the night runs at the requested level.
 */
export const targetEnergy = (energyLevel: number, stopIndex: number) =>
    stopIndex === 0 ? Math.max(1, energyLevel - 1) : energyLevel;

interface Fit {
    matches: number;
    budgetSteps: number | null;
    energySteps: number | null;
}

/**
 * "Vibe match" shown to users: how well a place fits what was asked for,
 * ignoring distance. Category/tag match counts half, budget and energy a quarter each.
 */
export function vibeMatchPercent(fit: Fit, askedForMatches: boolean): number {
    const matchFit = askedForMatches ? (fit.matches > 0 ? 1 : 0) : 1;
    const budgetFit = fit.budgetSteps === null ? 1 : 1 - fit.budgetSteps / 3;
    const energyFit = fit.energySteps === null ? 1 : 1 - fit.energySteps / 4;
    const pct = Math.round(100 * (0.5 * matchFit + 0.25 * budgetFit + 0.25 * energyFit));
    return Math.min(Math.max(pct, 10), 99);
}

/**
 * Greedy itinerary builder: from the current position, repeatedly pick the
 * best-scoring unvisited candidate that is open on arrival, until we run out
 * of time, stops, or candidates.
 */
export function buildItinerary(candidates: PlannerCandidate[], criteria: PlannerCriteria): ItineraryItem[] {
    const { vibes, categoryIds, transportMode, budget, energyLevel, maxStops, durationHours } = criteria;
    const endTime = criteria.startTime.getTime() + durationHours * 3_600_000;
    const askedForMatches = vibes.length + categoryIds.length > 0;

    // Energy only depends on the place, so compute it once.
    const energyOf = new Map(
        candidates.map(c => [c.id, estimateEnergy([...c.tagNames, ...c.categoryNames.values()])]),
    );

    const picks: { cand: PlannerCandidate; reason: string; matchScore: number }[] = [];
    const visited = new Set<number>();
    let here = criteria.startLocation;
    let now = criteria.startTime.getTime();

    while (picks.length < maxStops && now < endTime) {
        let best: { cand: PlannerCandidate; score: number; travel: number; fit: Fit } | null = null;

        for (const cand of candidates) {
            if (visited.has(cand.id)) continue;

            const to = { lat: cand.latitude, lng: cand.longitude };
            if (transportMode === 'walk' && distanceKm(here.lat, here.lng, to.lat, to.lng) > MAX_WALK_KM) continue;

            const travel = travelMinutes(here, to, transportMode);
            if (isOpenAt(cand.openHours, new Date(now + travel * 60_000)) === false) continue;

            const energy = energyOf.get(cand.id) ?? null;
            const fit: Fit = {
                matches:
                    vibes.filter(v => cand.tagNames.includes(v)).length +
                    categoryIds.filter(id => cand.categoryIds.includes(id)).length,
                budgetSteps: budget && cand.avgCost ? Math.abs(budget - cand.avgCost) : null,
                energySteps: energyLevel && energy !== null ? Math.abs(targetEnergy(energyLevel, picks.length) - energy) : null,
            };

            const score =
                travel * SCORE.perTravelMinute +
                fit.matches * SCORE.perMatch +
                (fit.budgetSteps ?? 0) * SCORE.perBudgetStep +
                (fit.energySteps ?? 0) * SCORE.perEnergyStep;

            if (!best || score > best.score) best = { cand, score, travel, fit };
        }

        if (!best) break;

        const { cand, travel, fit } = best;
        const matchedNames = [
            ...cand.categoryIds.filter(id => categoryIds.includes(id)).map(id => cand.categoryNames.get(id) ?? ''),
            ...cand.tagNames.filter(t => vibes.includes(t)),
        ].filter(Boolean);

        picks.push({
            cand,
            reason: matchedNames.length ? `Matches: ${matchedNames.join(', ')}` : 'Nearby pick',
            matchScore: vibeMatchPercent(fit, askedForMatches),
        });
        visited.add(cand.id);
        here = { lat: cand.latitude, lng: cand.longitude };
        now += (travel + (cand.avgStayMinutes || 90)) * 60_000;
    }

    // Final timings come from the same scheduler clients use when editing a plan.
    return scheduleStops(
        picks.map(({ cand, reason, matchScore }) => ({
            locationId: cand.id,
            name: cand.name,
            description: cand.description,
            latitude: cand.latitude,
            longitude: cand.longitude,
            avgStayMinutes: cand.avgStayMinutes,
            openHours: cand.openHours,
            reason,
            matchScore,
        })),
        { startTime: criteria.startTime, transportMode, startLocation: criteria.startLocation },
    );
}
