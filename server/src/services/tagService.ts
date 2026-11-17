import { prisma } from '../lib/prisma';

const include = { categories: true } as const;

export const tagService = {
    list() {
        return prisma.tag.findMany({ include, orderBy: { name: 'asc' } });
    },

    create(input: { name: string; categoryIds?: number[] }) {
        return prisma.tag.create({
            data: {
                name: input.name,
                categories: input.categoryIds?.length ? { connect: input.categoryIds.map(id => ({ id })) } : undefined,
            },
            include,
        });
    },

    rename(id: number, name: string) {
        return prisma.tag.update({ where: { id }, data: { name }, include });
    },

    addCategory(id: number, categoryId: number) {
        return prisma.tag.update({ where: { id }, data: { categories: { connect: { id: categoryId } } }, include });
    },

    removeCategory(id: number, categoryId: number) {
        return prisma.tag.update({ where: { id }, data: { categories: { disconnect: { id: categoryId } } }, include });
    },

    /** Also detaches the tag from every location (ON DELETE CASCADE). */
    async remove(id: number) {
        await prisma.tag.delete({ where: { id } });
    },
};
