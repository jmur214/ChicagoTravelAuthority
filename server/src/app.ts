import path from 'path';
import cors from 'cors';
import express from 'express';
import { config } from './config';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { createApiRouter, type ApiDeps } from './routes';

export interface AppOptions extends ApiDeps {
    /** Directory of the built web app (client/dist). When set, it's served at / with SPA fallback. */
    clientDir?: string;
}

/** Builds the Express app without starting it, so tests can drive it directly. */
export function createApp({ clientDir, ...deps }: AppOptions) {
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

    if (clientDir) {
        // Hashed build assets never change; everything else revalidates.
        app.use('/assets', express.static(path.join(clientDir, 'assets'), { immutable: true, maxAge: '1y' }));
        app.use(express.static(clientDir, { index: false }));
        // Client-side routes: any other GET outside /api gets the app shell.
        app.use((req, res, next) => {
            if (req.method !== 'GET' || req.path === '/api' || req.path.startsWith('/api/')) return next();
            res.setHeader('Cache-Control', 'no-cache');
            res.sendFile(path.join(clientDir, 'index.html'));
        });
    }

    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
}
