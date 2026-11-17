import { defineConfig } from 'vitest/config';

/**
 * Integration tests (tests/api.test.ts) run against a real Postgres when
 * TEST_DATABASE_URL is set. The database is reset and migrated before the run,
 * so never point it at a database you care about.
 */
export default defineConfig({
    test: {
        include: ['tests/**/*.test.ts'],
        globalSetup: ['tests/globalSetup.ts'],
        env: {
            NODE_ENV: 'test',
            DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgresql://unused@localhost:1/unused',
        },
        // Integration tests share one database.
        fileParallelism: false,
    },
});
