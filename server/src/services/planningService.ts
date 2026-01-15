import prisma from '../prismaClient';

interface PlanningCriteria {
    startTime: Date;
    durationHours: number;
    vibes: string[]; // e.g., ["Cozy", "Cocktails"]
    neighborhoods?: string[];
}

interface ItineraryItem {
    order: number;
    locationId: number;
    name: string;
    arrivalTime: Date;
    departureTime: Date;
    reason: string;
}

export class PlanningService {
    async generatePlan(criteria: PlanningCriteria): Promise<ItineraryItem[]> {
        // 1. Fetch Candidates (filter by neighborhoods if provided)
        const whereClause: any = {};
        if (criteria.neighborhoods && criteria.neighborhoods.length > 0) {
            // This assumes locations have tags with category 'Neighborhood' matching the names
            whereClause.tags = {
                some: {
                    tag: {
                        name: { in: criteria.neighborhoods },
                        category: { name: 'Neighborhood' }
                    }
                }
            };
        }

        const candidates = await prisma.location.findMany({
            where: whereClause,
            include: { tags: { include: { tag: true } } }
        });

        // 2. Score Candidates
        const scored = candidates.map((loc: any) => {
            let score = 0;
            const reasons: string[] = [];

            // Simple scoring: Match vibes
            const locTags = loc.tags.map((t: any) => t.tag.name);

            // Primary matches
            if (criteria.vibes.some(v => locTags.includes(v))) {
                score += 10;
                reasons.push("Matches vibe");
            }

            // Energy/Time check (Basic heuristic)
            // If night (after 6pm), boost Bars/Nightlife
            // ... (implement more logic later)

            return { loc, score, reasons };
        });

        // 3. Sort and Select
        const topPicks = scored.sort((a: any, b: any) => b.score - a.score).slice(0, 5);

        // 4. Build Sequence (Just linear for now)
        const plan: ItineraryItem[] = [];
        let currentTime = new Date(criteria.startTime);

        topPicks.forEach((pick: any, index: number) => {
            const stayDuration = 90 * 60000; // 1.5 hours
            const departure = new Date(currentTime.getTime() + stayDuration);

            plan.push({
                order: index + 1,
                locationId: pick.loc.id,
                name: pick.loc.name,
                arrivalTime: new Date(currentTime),
                departureTime: departure,
                reason: pick.reasons.join(', ') || 'Suggested stop'
            });

            currentTime = departure; // Travel time ignored for MVP
            // Add travel buffer?
        });

        return plan;
    }
}
