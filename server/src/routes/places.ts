import { Router } from 'express';
import { CreateFromPlaceSchema, IdParamSchema, PlaceMatchSchema, PlaceSearchQuerySchema, type PlacesStatus } from '@cta/shared';
import type { EnrichmentService } from '../services/places/enrichmentService';

/** Place lookup and enrichment (Google Places). */
export function createPlacesRouter(enrichment: EnrichmentService): Router {
    const router = Router();

    router.get('/places/status', (_req, res) => {
        const status: PlacesStatus = { provider: 'google', configured: enrichment.configured };
        res.json(status);
    });

    router.get('/places/search', async (req, res) => {
        const { q, lat, lng } = PlaceSearchQuerySchema.parse(req.query);
        const near = lat !== undefined && lng !== undefined ? { lat, lng } : undefined;
        res.json(await enrichment.search(q, near));
    });

    router.post('/locations/from-place', async (req, res) => {
        res.status(201).json(await enrichment.createFromPlace(CreateFromPlaceSchema.parse(req.body)));
    });

    /** Match a location to its listing (or refresh it if already matched). */
    router.post('/locations/:id/enrich', async (req, res) => {
        res.json(await enrichment.enrich(IdParamSchema.parse(req.params.id)));
    });

    /** Resolve a review: link to a chosen place, or mark "not on Google". */
    router.post('/locations/:id/match', async (req, res) => {
        const id = IdParamSchema.parse(req.params.id);
        const body = PlaceMatchSchema.parse(req.body);
        res.json('ignore' in body ? await enrichment.ignore(id) : await enrichment.match(id, body.externalId));
    });

    return router;
}
