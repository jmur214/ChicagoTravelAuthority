
import { Request, Response } from 'express';
import prisma from '../prismaClient';

export const getCategories = async (req: Request, res: Response) => {
    const categories = await prisma.tagCategory.findMany({
        include: { tags: true }
    });
    res.json(categories);
};

export const createCategory = async (req: Request, res: Response) => {
    const { name, parentId, color, shape } = req.body;
    try {
        const category = await prisma.tagCategory.create({
            data: {
                name,
                parentId: parentId ? Number(parentId) : null,
                color: color || '#ffffff',
                shape: shape || 'circle'
            }
        });
        res.json(category);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to create category' });
    }
};

export const updateCategory = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, parentId, color, shape } = req.body;
    try {
        const category = await prisma.tagCategory.update({
            where: { id: Number(id) },
            data: {
                name,
                parentId: parentId !== undefined ? (parentId ? Number(parentId) : null) : undefined,
                color: color,
                shape: shape
            }
        });
        res.json(category);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to update category' });
    }
};

export const deleteCategory = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        await prisma.tagCategory.delete({ where: { id: Number(id) } });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete category' });
    }
};
