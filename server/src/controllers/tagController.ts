import { Request, Response } from 'express';
import prisma from '../prismaClient';

export const getTags = async (req: Request, res: Response) => {
    const tags = await prisma.tag.findMany({ include: { categories: true } });
    res.json(tags);
};

export const createTag = async (req: Request, res: Response) => {
    const { name, categoryId, categoryIds } = req.body;
    try {
        const ids = categoryIds || (categoryId ? [categoryId] : []);
        const tag = await prisma.tag.create({
            data: {
                name,
                categories: {
                    connect: ids.map((id: number) => ({ id: Number(id) }))
                }
            },
            include: { categories: true }
        });
        res.json(tag);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed create tag' });
    }
};

export const updateTag = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, categoryId } = req.body; // Legacy support or single move if UI sends it
    // Actually, simple update might just be name. Category mgmt is separate now.
    try {
        const tag = await prisma.tag.update({
            where: { id: Number(id) },
            data: { name },
            include: { categories: true }
        });
        res.json(tag);
    } catch (e) {
        res.status(500).json({ error: 'Failed update tag' });
    }
};

export const addCategoryToTag = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { categoryId } = req.body;
    try {
        const tag = await prisma.tag.update({
            where: { id: Number(id) },
            data: {
                categories: { connect: { id: Number(categoryId) } }
            },
            include: { categories: true }
        });
        res.json(tag);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to add category to tag' });
    }
};

export const removeCategoryFromTag = async (req: Request, res: Response) => {
    const { id, categoryId } = req.params;
    try {
        const tag = await prisma.tag.update({
            where: { id: Number(id) },
            data: {
                categories: { disconnect: { id: Number(categoryId) } }
            },
            include: { categories: true }
        });
        res.json(tag);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to remove category from tag' });
    }
};

export const deleteTag = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        await prisma.tag.delete({ where: { id: Number(id) } });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed delete tag' });
    }
};
