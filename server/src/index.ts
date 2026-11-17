import fs from 'fs';
import path from 'path';
import { config } from './config';
import { createApp } from './app';
import { prisma } from './lib/prisma';
import { CtaService } from './services/transit/ctaService';
import { GtfsService } from './services/transit/gtfsService';

const cta = new CtaService(config.cta.apiKey);
const gtfs = new GtfsService(config.gtfsDir);

const clientDir = fs.existsSync(path.join(config.clientDistDir, 'index.html')) ? config.clientDistDir : undefined;

const server = createApp({ cta, gtfs, clientDir }).listen(config.port, () => {
    console.log(`API listening on http://localhost:${config.port}/api/v1 (${config.env})`);
    if (clientDir) console.log(`Serving the web app at http://localhost:${config.port}/ from ${clientDir}`);
    if (config.isProduction && !config.corsOrigins) {
        console.warn('[config] CORS_ORIGINS is not set — any website can call this API.');
    }
    cta.start(config.cta.pollIntervalMs);
    void gtfs.initialize();
});

const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down...`);
    cta.stop();
    server.close(() => {
        void prisma.$disconnect().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
