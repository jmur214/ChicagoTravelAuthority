import cors from 'cors';
import express from 'express';
import { config } from './config';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { createApiRouter, type ApiDeps } from './routes';

/** Builds the Express app without starting it, so tests can drive it directly. */
export function createApp(deps: ApiDeps) {
    const app = express();

    app.disable('x-powered-by');
    app.use(cors(config.corsOrigins ? { origin: config.corsOrigins } : undefined));
    app.use(express.json({ limit: '1mb' }));

    const api = createApiRouter(deps);
    app.use('/api/v1', api);
    // Unversioned alias for older web builds. New clients (incl. mobile) should use /api/v1.
    app.use('/api', api);

    app.get('/health', (_req, res) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
}
