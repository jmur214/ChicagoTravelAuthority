import { Router, type RequestHandler } from 'express';
import { IdParamSchema, LocationCreateSchema, LocationListQuerySchema, LocationUpdateSchema } from '@cta/shared';
import { locationService } from '../services/locationService';

export const locationsRouter = Router();

locationsRouter.get('/', async (req, res) => {
    const { all } = LocationListQuerySchema.parse(req.query);
    res.json(await locationService.list({ includeUnconfirmed: all }));
});

locationsRouter.get('/:id', async (req, res) => {
    res.json(await locationService.get(IdParamSchema.parse(req.params.id)));
});

locationsRouter.post('/', async (req, res) => {
    const location = await locationService.create(LocationCreateSchema.parse(req.body));
    res.status(201).json(location);
});

// PUT is kept for backwards compatibility; both have partial-update semantics.
const update: RequestHandler = async (req, res) => {
    const id = IdParamSchema.parse(req.params.id);
    res.json(await locationService.update(id, LocationUpdateSchema.parse(req.body)));
};
locationsRouter.patch('/:id', update);
locationsRouter.put('/:id', update);

locationsRouter.delete('/:id', async (req, res) => {
    await locationService.remove(IdParamSchema.parse(req.params.id));
    res.status(204).end();
});
