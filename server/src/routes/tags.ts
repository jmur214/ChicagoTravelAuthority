import { Router, type RequestHandler } from 'express';
import { IdParamSchema, TagCategoryLinkSchema, TagCreateSchema, TagUpdateSchema } from '@cta/shared';
import { tagService } from '../services/tagService';

export const tagsRouter = Router();

tagsRouter.get('/', async (_req, res) => {
    res.json(await tagService.list());
});

tagsRouter.post('/', async (req, res) => {
    res.status(201).json(await tagService.create(TagCreateSchema.parse(req.body)));
});

const rename: RequestHandler = async (req, res) => {
    const id = IdParamSchema.parse(req.params.id);
    const { name } = TagUpdateSchema.parse(req.body);
    res.json(await tagService.rename(id, name));
};
tagsRouter.patch('/:id', rename);
tagsRouter.put('/:id', rename);

tagsRouter.delete('/:id', async (req, res) => {
    await tagService.remove(IdParamSchema.parse(req.params.id));
    res.status(204).end();
});

tagsRouter.post('/:id/categories', async (req, res) => {
    const id = IdParamSchema.parse(req.params.id);
    const { categoryId } = TagCategoryLinkSchema.parse(req.body);
    res.json(await tagService.addCategory(id, categoryId));
});

tagsRouter.delete('/:id/categories/:categoryId', async (req, res) => {
    const id = IdParamSchema.parse(req.params.id);
    const categoryId = IdParamSchema.parse(req.params.categoryId);
    res.json(await tagService.removeCategory(id, categoryId));
});
