import { Router, type RequestHandler } from 'express';
import { CategoryCreateSchema, CategoryUpdateSchema, IdParamSchema } from '@cta/shared';
import { categoryService } from '../services/categoryService';

export const categoriesRouter = Router();

categoriesRouter.get('/', async (_req, res) => {
    res.json(await categoryService.list());
});

categoriesRouter.post('/', async (req, res) => {
    res.status(201).json(await categoryService.create(CategoryCreateSchema.parse(req.body)));
});

const update: RequestHandler = async (req, res) => {
    const id = IdParamSchema.parse(req.params.id);
    res.json(await categoryService.update(id, CategoryUpdateSchema.parse(req.body)));
};
categoriesRouter.patch('/:id', update);
categoriesRouter.put('/:id', update);

categoriesRouter.delete('/:id', async (req, res) => {
    await categoryService.remove(IdParamSchema.parse(req.params.id));
    res.status(204).end();
});
