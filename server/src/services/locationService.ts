import { Prisma } from '@prisma/client';
import { ENRICHABLE_FIELDS, type FieldSources, type LocationCreate, type LocationUpdate, type OpenHours } from '@cta/shared';
import { prisma } from '../lib/prisma';
import { deepEqual as same } from '../lib/deepEqual';

export const locationInclude = {
    tags: { include: { tag: true } },
    categories: true,
} satisfies Prisma.LocationInclude;

/** Prisma needs an explicit sentinel to write SQL NULL into a Json column. */
const toJson = (hours: OpenHours | null | undefined) =>
    hours === undefined ? undefined : hours === null ? Prisma.DbNull : (hours as Prisma.InputJsonValue);

/** Scalar fields shared by create and update; relations are handled separately. */
function scalarData(input: LocationUpdate) {
    const { tagIds: _tagIds, categoryIds: _categoryIds, openHours, ...scalars } = input;
    return { ...scalars, openHours: toJson(openHours) };
}


/**
 * Mark enrichable fields a person changed as `manual`, so automated enrichment
 * never overwrites them. Unchanged fields keep their existing provenance —
 * the admin form re-sends every field on save.
 */
export function markManualEdits(
    current: Record<string, unknown> | null,
    input: Partial<Record<string, unknown>>,
    at = new Date().toISOString(),
): FieldSources | undefined {
    const sources: FieldSources = { ...((current?.fieldSources as FieldSources | null) ?? {}) };
    let changed = false;
    for (const field of ENRICHABLE_FIELDS) {
        if (!(field in input) || input[field] === undefined) continue;
        if (current && same(current[field], input[field])) continue;
        if (!current && (input[field] === null || input[field] === '')) continue;
        sources[field] = { source: 'manual', at };
        changed = true;
    }
    return changed ? sources : undefined;
}

/** Shown on the public map and to the planner: hides places Google reports as permanently closed. */
export const notPermanentlyClosed: Prisma.LocationWhereInput = {
    OR: [{ businessStatus: null }, { businessStatus: { not: 'CLOSED_PERMANENTLY' } }],
};

export const locationService = {
    list({ includeUnconfirmed }: { includeUnconfirmed: boolean }) {
        return prisma.location.findMany({
            where: includeUnconfirmed ? {} : { isConfirmed: true, ...notPermanentlyClosed },
            include: locationInclude,
            orderBy: { name: 'asc' },
        });
    },

    get(id: number) {
        return prisma.location.findUniqueOrThrow({ where: { id }, include: locationInclude });
    },

    create(input: LocationCreate) {
        const fieldSources = markManualEdits(null, input);
        return prisma.location.create({
            data: {
                ...scalarData(input),
                name: input.name,
                latitude: input.latitude,
                longitude: input.longitude,
                ...(fieldSources && { fieldSources: fieldSources as Prisma.InputJsonValue }),
                tags: input.tagIds ? { create: input.tagIds.map(tagId => ({ tagId })) } : undefined,
                categories: input.categoryIds ? { connect: input.categoryIds.map(id => ({ id })) } : undefined,
            },
            include: locationInclude,
        });
    },

    /**
     * Partial update: only fields present in `input` change. Passing `tagIds` or
     * `categoryIds` replaces that whole set. Nested writes run in one transaction.
     */
    async update(id: number, input: LocationUpdate) {
        const current = await prisma.location.findUniqueOrThrow({ where: { id } });
        const fieldSources = markManualEdits(current as unknown as Record<string, unknown>, input);
        return prisma.location.update({
            where: { id },
            data: {
                ...scalarData(input),
                ...(fieldSources && { fieldSources: fieldSources as Prisma.InputJsonValue }),
                tags: input.tagIds
                    ? { deleteMany: {}, create: input.tagIds.map(tagId => ({ tagId })) }
                    : undefined,
                categories: input.categoryIds ? { set: input.categoryIds.map(cid => ({ id: cid })) } : undefined,
            },
            include: locationInclude,
        });
    },

    async remove(id: number) {
        await prisma.location.delete({ where: { id } });
    },
};
