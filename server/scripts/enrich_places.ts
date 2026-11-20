/**
 * Match and enrich places from the terminal — the same pipeline as the admin
 * "Match & enrich" button. Requires GOOGLE_PLACES_KEY in server/.env.
 *
 * Usage:
 *   npx tsx scripts/enrich_places.ts                  # places never checked
 *   npx tsx scripts/enrich_places.ts --refresh 60     # also refresh matches older than 60 days
 *   npx tsx scripts/enrich_places.ts --limit 20       # stop after 20 places
 */
import { config } from '../src/config';
import { prisma } from '../src/lib/prisma';
import { EnrichmentService } from '../src/services/places/enrichmentService';
import { GooglePlacesProvider } from '../src/services/places/google';

const arg = (name: string) => {
    const i = process.argv.indexOf(name);
    return i === -1 ? undefined : Number(process.argv[i + 1]);
};

async function main() {
    if (!config.places.apiKey) {
        console.error('GOOGLE_PLACES_KEY is not set in server/.env');
        process.exit(1);
    }
    const service = new EnrichmentService(new GooglePlacesProvider(config.places.apiKey, config.places.baseUrl));
    const refreshDays = arg('--refresh');
    const limit = arg('--limit');

    const staleBefore = refreshDays !== undefined ? new Date(Date.now() - refreshDays * 86_400_000) : null;
    const targets = await prisma.location.findMany({
        where: {
            OR: [
                { matchStatus: 'unmatched' },
                ...(staleBefore ? [{ matchStatus: 'matched', OR: [{ enrichedAt: null }, { enrichedAt: { lt: staleBefore } }] }] : []),
            ],
        },
        select: { id: true, name: true },
        orderBy: { id: 'asc' },
        take: limit,
    });

    console.log(`Checking ${targets.length} places…\n`);
    const tally: Record<string, number> = {};

    for (const { id, name } of targets) {
        try {
            const result = await service.enrich(id);
            tally[result.status] = (tally[result.status] ?? 0) + 1;
            const detail = result.status === 'matched'
                ? result.changes.length ? `updated ${result.changes.map(c => c.field).join(', ')}` : 'up to date'
                : `${result.candidates.length} candidate(s) — review in the admin`;
            console.log(`  ${result.status.padEnd(12)} ${name} — ${detail}`);
        } catch (err) {
            tally.error = (tally.error ?? 0) + 1;
            console.log(`  ${'error'.padEnd(12)} ${name} — ${err instanceof Error ? err.message : err}`);
            if (err instanceof Error && /rejected the API key/.test(err.message)) break;
        }
        await new Promise(r => setTimeout(r, 150)); // stay well under rate limits
    }

    console.log('\nSummary:', Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(', ') || 'nothing to do');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
