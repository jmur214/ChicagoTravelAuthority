import 'dotenv/config';
import path from 'path';
import { z } from 'zod';

const EnvSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required (see server/.env.example)'),
    /**
     * Comma-separated list of allowed browser origins, e.g.
     * "https://chicagotravelauthority.com,http://localhost:5173".
     * Unset = allow any origin (fine for local dev; native mobile apps don't use CORS).
     */
    CORS_ORIGINS: z.string().optional(),
    CTA_TRAIN_API_KEY: z.string().optional(),
    CTA_POLL_INTERVAL_MS: z.coerce.number().int().min(5000).default(20000),
    GTFS_DIR: z.string().default(path.resolve(__dirname, '../../google_transit')),
    MAX_UPLOAD_MB: z.coerce.number().positive().default(10),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
    const problems = parsed.error.issues.map(i => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
}

const env = parsed.data;

export const config = {
    env: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    port: env.PORT,
    corsOrigins: env.CORS_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean),
    cta: {
        apiKey: env.CTA_TRAIN_API_KEY || undefined,
        pollIntervalMs: env.CTA_POLL_INTERVAL_MS,
    },
    gtfsDir: env.GTFS_DIR,
    maxUploadBytes: env.MAX_UPLOAD_MB * 1024 * 1024,
} as const;
