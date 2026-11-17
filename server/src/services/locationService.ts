import { Prisma } from '@prisma/client';
import type { LocationCreate, LocationUpdate, OpenHours } from '@cta/shared';
import { prisma } from '../lib/prisma';

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

export const locationService = {
    list({ includeUnconfirmed }: { includeUnconfirmed: boolean }) {
        return prisma.location.findMany({
            where: includeUnconfirmed ? {} : { isConfirmed: true },
            include: locationInclude,
            orderBy: { name: 'asc' },
        });
    },

    get(id: number) {
        return prisma.location.findUniqueOrThrow({ where: { id }, include: locationInclude });
    },

    create(input: LocationCreate) {
        return prisma.location.create({
            data: {
                ...scalarData(input),
                name: input.name,
                latitude: input.latitude,
                longitude: input.longitude,
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
    update(id: number, input: LocationUpdate) {
        return prisma.location.update({
            where: { id },
            data: {
                ...scalarData(input),
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
