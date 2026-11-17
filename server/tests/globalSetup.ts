import { execSync } from 'child_process';

export default function setup() {
    const url = process.env.TEST_DATABASE_URL;
    if (!url) {
        console.log('[tests] TEST_DATABASE_URL not set — skipping API integration tests.');
        return;
    }
    if (!/test/i.test(new URL(url).pathname)) {
        throw new Error(`Refusing to reset "${url}": the database name must contain "test".`);
    }
    // Applies every migration to an empty DB — this also proves the migration history is complete.
    execSync('npx prisma migrate reset --force --skip-seed --skip-generate', {
        stdio: 'inherit',
        env: { ...process.env, DATABASE_URL: url },
    });
}
