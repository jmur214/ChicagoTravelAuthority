import { z } from 'zod';
import { CategoryCreateSchema, CategoryUpdateSchema } from '@cta/shared';
import { prisma } from '../lib/prisma';
import { badRequest } from '../lib/httpError';

type CategoryCreate = z.output<typeof CategoryCreateSchema>;
type CategoryUpdate = z.output<typeof CategoryUpdateSchema>;

export const categoryService = {
    list() {
        return prisma.tagCategory.findMany({ include: { tags: true }, orderBy: { name: 'asc' } });
    },

    create(input: CategoryCreate) {
        return prisma.tagCategory.create({ data: input });
    },

    async update(id: number, input: CategoryUpdate) {
        if (input.parentId !== undefined && input.parentId !== null) {
            await assertNoCycle(id, input.parentId);
        }
        return prisma.tagCategory.update({ where: { id }, data: input });
    },

    async remove(id: number) {
        // Children are re-parented to the root (ON DELETE SET NULL).
        await prisma.tagCategory.delete({ where: { id } });
    },
};

/** Prevent making a category its own ancestor, which would hang tree rendering. */
async function assertNoCycle(id: number, newParentId: number) {
    let cursor: number | null = newParentId;
    const seen = new Set<number>();
    while (cursor !== null && !seen.has(cursor)) {
        if (cursor === id) throw badRequest('A category cannot be nested inside itself');
        seen.add(cursor);
        const parent: { parentId: number | null } | null = await prisma.tagCategory.findUnique({
            where: { id: cursor },
            select: { parentId: true },
        });
        cursor = parent?.parentId ?? null;
    }
}
