import { Router } from 'express';
import multer from 'multer';
import { PlanRequestSchema } from '@cta/shared';
import { config } from '../config';
import { badRequest } from '../lib/httpError';
import { importKmlFile } from '../services/importService';
import { generatePlan } from '../services/planning/planService';
import { EnrichmentService } from '../services/places/enrichmentService';
import type { PlacesProvider } from '../services/places/provider';
import type { CtaService } from '../services/transit/ctaService';
import type { GtfsService } from '../services/transit/gtfsService';
import { categoriesRouter } from './categories';
import { locationsRouter } from './locations';
import { createPlacesRouter } from './places';
import { tagsRouter } from './tags';

export interface ApiDeps {
    cta: CtaService;
    gtfs: GtfsService;
    /** null when no places API key is configured */
    places?: PlacesProvider | null;
}

export function createApiRouter({ cta, gtfs, places = null }: ApiDeps): Router {
    const router = Router();
    const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxUploadBytes } });

    router.get('/health', (_req, res) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Mounted before /locations so /locations/from-place isn't treated as an id.
    router.use(createPlacesRouter(new EnrichmentService(places)));
    router.use('/locations', locationsRouter);
    router.use('/categories', categoriesRouter);
    router.use('/tags', tagsRouter);

    router.post('/plan', async (req, res) => {
        res.json(await generatePlan(PlanRequestSchema.parse(req.body ?? {})));
    });

    router.post('/import', upload.single('file'), async (req, res) => {
        if (!req.file) throw badRequest('No file uploaded (expected multipart field "file")');
        res.json(await importKmlFile(req.file.buffer));
    });

    router.get('/trains', (_req, res) => {
        res.json(cta.getSnapshot());
    });

    router.get('/gtfs/routes', (_req, res) => {
        res.json(gtfs.getRoutes());
    });

    return router;
}
