import prisma from '../prismaClient';

interface PlanningCriteria {
    startLocation: { lat: number, lng: number };
    startTime: Date;
    durationHours: number;
    vibes?: string[]; // Deprecated, but keeping
    categoryIds?: number[]; // New
    neighborhoods?: string[];
    transportMode: 'walk' | 'drive' | 'transit';
    budget?: number; // 1-4
    maxStops?: number;
}

interface ItineraryItem {
    order: number;
    locationId: number;
    name: string;
    description?: string;
    arrivalTime: Date;
    departureTime: Date;
    reason: string;
    coords: { lat: number, lng: number };
    travelTimeMinutes: number; // Time to get here from previous
    matchScore: number;
}

// Simple Haversine
function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export class SmartPlanningService {

    async generateItinerary(criteria: PlanningCriteria): Promise<ItineraryItem[]> {
        const { startLocation, startTime, vibes = [], categoryIds = [], transportMode, budget, maxStops = 5 } = criteria;

        // 1. Fetch Candidates (broad filter)
        // We fetch ALL candidates that match vibes OR categories
        const whereClause: any = {};

        const conditions: any[] = [];
        if (vibes.length > 0) {
            conditions.push({ tags: { some: { tag: { name: { in: vibes } } } } });
        }
        if (categoryIds.length > 0) {
            conditions.push({ categories: { some: { id: { in: categoryIds } } } });
        }

        if (conditions.length > 0) {
            whereClause.OR = conditions;
        }

        const candidates = await prisma.location.findMany({
            where: whereClause,
            include: {
                tags: { include: { tag: true } },
                categories: true
            }
        });

        const plan: ItineraryItem[] = [];
        const visitedIds = new Set<number>();

        let currentLat = startLocation.lat;
        let currentLng = startLocation.lng;
        let currentTime = new Date(startTime);

        // Transport Speeds (km/h) - very rough estimates
        const speeds = { walk: 5, drive: 30, transit: 15 };
        const speed = speeds[transportMode];

        for (let i = 0; i < maxStops; i++) {
            // Check if we have time left
            const timeElapsed = (currentTime.getTime() - new Date(startTime).getTime()) / 3600000;
            if (timeElapsed >= criteria.durationHours) break;

            // Score Candidates
            let bestCandidate: any = null;
            let bestScore = -Infinity;
            let bestTravelTime = 0;

            for (const cand of candidates) {
                if (visitedIds.has(cand.id)) continue;

                // --- Scoring Logic ---
                let score = 0;

                // 1. Distance & Travel Time penalty
                const dist = getDistanceKm(currentLat, currentLng, cand.latitude, cand.longitude);
                const travelMinutes = (dist / speed) * 60;

                // Hard constraints on distance depending on mode?
                if (transportMode === 'walk' && dist > 1.5) continue; // Skip if > 1.5km walk

                // Penalty: -2 points per minute of travel (Aggressive distance weighting)
                score -= (travelMinutes * 2);

                // 2. Vibe/Category Match Boost
                const candTags = cand.tags.map((t: any) => t.tag.name);
                const candCatIds = cand.categories.map((c: any) => c.id);

                let matchCount = 0;

                // Tag Matches
                if (vibes.length > 0) {
                    matchCount += vibes.filter(v => candTags.includes(v)).length;
                }

                // Category Matches
                if (categoryIds.length > 0) {
                    const catMatches = categoryIds.filter(id => candCatIds.includes(id)).length;
                    matchCount += catMatches; // Categories are strong signals
                }

                score += (matchCount * 15);

                // 3. Opening Hours Check (Simplified: Check if undefined or allow logic later)
                // TODO: Implement proper JSON parsing for cand.openHours

                // 4. Budget Match
                if (budget && cand.avgCost) {
                    const diff = Math.abs(budget - cand.avgCost);
                    score -= (diff * 20); // Strict budget penalty
                }

                if (score > bestScore) {
                    bestScore = score;
                    bestCandidate = cand;
                    bestTravelTime = travelMinutes;
                }
            }

            if (!bestCandidate) break; // No more valid options

            // Add to plan
            visitedIds.add(bestCandidate.id);
            const stayMinutes = bestCandidate.avgStayMinutes || 90;

            // Arrival is after travel
            const arrival = new Date(currentTime.getTime() + bestTravelTime * 60000);
            const departure = new Date(arrival.getTime() + stayMinutes * 60000);

            // Normalize Score
            const matchScore = Math.min(Math.max(Math.round(((bestScore + 20) / 60) * 100), 10), 99);

            // Build reason string
            const matchedCats = bestCandidate.categories.filter((c: any) => categoryIds.includes(c.id)).map((c: any) => c.name);
            const matchedTags = bestCandidate.tags.filter((t: any) => vibes.includes(t.tag.name)).map((t: any) => t.tag.name);
            const reason = `Matches: ${[...matchedCats, ...matchedTags].join(', ')}`;

            plan.push({
                order: i + 1,
                locationId: bestCandidate.id,
                name: bestCandidate.name,
                description: bestCandidate.description || '',
                coords: { lat: bestCandidate.latitude, lng: bestCandidate.longitude },
                arrivalTime: arrival,
                departureTime: departure,
                reason,
                travelTimeMinutes: Math.round(bestTravelTime),
                matchScore
            });

            // Update State
            currentTime = departure;
            currentLat = bestCandidate.latitude;
            currentLng = bestCandidate.longitude;
        }

        return plan;
    }
}
