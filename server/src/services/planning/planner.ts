import { distanceKm, getOpenStatus, type ItineraryItem, type OpenHours, type TransportMode } from '@cta/shared';

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
    startLocation: { lat: number; lng: number };
    startTime: Date;
    durationHours: number;
    vibes: string[];
    categoryIds: number[];
    transportMode: TransportMode;
    budget?: number;
    maxStops: number;
}

/** Rough average speeds, km/h. */
export const SPEED_KMH: Record<TransportMode, number> = { walk: 5, drive: 30, transit: 15 };
export const MAX_WALK_KM = 1.5;

const SCORE = {
    perTravelMinute: -2,
    perMatch: 15,
    perBudgetStep: -20,
} as const;

const toMatchPercent = (score: number) => Math.min(Math.max(Math.round(((score + 20) / 60) * 100), 10), 99);

/**
 * Greedy itinerary builder: from the current position, repeatedly pick the
 * best-scoring unvisited candidate (closest + most matches + on budget) that is
 * open on arrival, until we run out of time, stops, or candidates.
 */
export function buildItinerary(candidates: PlannerCandidate[], criteria: PlannerCriteria): ItineraryItem[] {
    const { vibes, categoryIds, transportMode, budget, maxStops, durationHours } = criteria;
    const speed = SPEED_KMH[transportMode];
    const endTime = criteria.startTime.getTime() + durationHours * 3_600_000;

    const plan: ItineraryItem[] = [];
    const visited = new Set<number>();
    let here = criteria.startLocation;
    let now = criteria.startTime.getTime();

    while (plan.length < maxStops && now < endTime) {
        let best: { cand: PlannerCandidate; score: number; travelMinutes: number } | null = null;

        for (const cand of candidates) {
            if (visited.has(cand.id)) continue;

            const km = distanceKm(here.lat, here.lng, cand.latitude, cand.longitude);
            if (transportMode === 'walk' && km > MAX_WALK_KM) continue;

            const travelMinutes = (km / speed) * 60;
            const arrival = new Date(now + travelMinutes * 60_000);
            if (getOpenStatus(cand.openHours, arrival).state === 'closed') continue;

            const matches =
                vibes.filter(v => cand.tagNames.includes(v)).length +
                categoryIds.filter(id => cand.categoryIds.includes(id)).length;

            let score = travelMinutes * SCORE.perTravelMinute + matches * SCORE.perMatch;
            if (budget && cand.avgCost) score += Math.abs(budget - cand.avgCost) * SCORE.perBudgetStep;

            if (!best || score > best.score) best = { cand, score, travelMinutes };
        }

        if (!best) break;

        const { cand, score, travelMinutes } = best;
        const arrival = now + travelMinutes * 60_000;
        const departure = arrival + (cand.avgStayMinutes || 90) * 60_000;

        const matchedNames = [
            ...cand.categoryIds.filter(id => categoryIds.includes(id)).map(id => cand.categoryNames.get(id) ?? ''),
            ...cand.tagNames.filter(t => vibes.includes(t)),
        ].filter(Boolean);

        plan.push({
            order: plan.length + 1,
            locationId: cand.id,
            name: cand.name,
            description: cand.description ?? '',
            coords: { lat: cand.latitude, lng: cand.longitude },
            arrivalTime: new Date(arrival).toISOString(),
            departureTime: new Date(departure).toISOString(),
            reason: matchedNames.length ? `Matches: ${matchedNames.join(', ')}` : 'Nearby pick',
            travelTimeMinutes: Math.round(travelMinutes),
            matchScore: toMatchPercent(score),
        });

        visited.add(cand.id);
        here = { lat: cand.latitude, lng: cand.longitude };
        now = departure;
    }

    return plan;
}
