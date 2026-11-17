import { CHICAGO_CENTER, OpenHoursSchema, type PlanRequest, type PlanResponse } from '@cta/shared';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { buildItinerary, type PlannerCandidate } from './planner';

export async function generatePlan(request: PlanRequest): Promise<PlanResponse> {
    const { vibes, categoryIds } = request;

    const matchAny: Prisma.LocationWhereInput[] = [];
    if (vibes.length) matchAny.push({ tags: { some: { tag: { name: { in: vibes } } } } });
    if (categoryIds.length) matchAny.push({ categories: { some: { id: { in: categoryIds } } } });

    const rows = await prisma.location.findMany({
        where: { isConfirmed: true, ...(matchAny.length ? { OR: matchAny } : {}) },
        include: { tags: { include: { tag: true } }, categories: true },
    });

    const candidates: PlannerCandidate[] = rows.map(row => {
        // Hours are free-form JSON in the DB; treat anything malformed as "unknown".
        const hours = OpenHoursSchema.safeParse(row.openHours);
        return {
            id: row.id,
            name: row.name,
            description: row.description,
            latitude: row.latitude,
            longitude: row.longitude,
            avgCost: row.avgCost,
            avgStayMinutes: row.avgStayMinutes,
            openHours: row.openHours && hours.success ? hours.data : null,
            tagNames: row.tags.map(t => t.tag.name),
            categoryIds: row.categories.map(c => c.id),
            categoryNames: new Map(row.categories.map(c => [c.id, c.name])),
        };
    });

    const items = buildItinerary(candidates, {
        startLocation: request.startLocation ?? CHICAGO_CENTER,
        startTime: request.startTime ? new Date(request.startTime) : new Date(),
        durationHours: request.durationHours,
        vibes,
        categoryIds,
        transportMode: request.transportMode,
        budget: request.budget,
        maxStops: request.maxStops,
    });

    return { items };
}
