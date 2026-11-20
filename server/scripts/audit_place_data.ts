/**
 * Find (and with --fix, clean up) place data produced by the old enrichment scripts:
 *  - opening hours stamped from seed_hours.ts templates (not real hours)
 *  - hours saved in a shape the app can't read (old Google script: closed days as nulls)
 *  - generated marketing descriptions ("X is a Top-rated destination in Chicago (...)")
 *  - prices guessed alongside template hours (marked as estimates, replaced on enrichment)
 *
 * Usage:
 *   npx tsx scripts/audit_place_data.ts         # report only
 *   npx tsx scripts/audit_place_data.ts --fix   # apply
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { CLOSED_DAY, DAY_KEYS, OpenHoursSchema, type FieldSources, type OpenHours } from '@cta/shared';
import { deepEqual } from '../src/lib/deepEqual';

const prisma = new PrismaClient();
const FIX = process.argv.includes('--fix');

const week = (weekday: [string, string], fri: [string, string], sat: [string, string], sun: [string, string]): OpenHours => {
    const d = ([open, close]: [string, string]) => ({ isOpen: true, open, close });
    return { mon: d(weekday), tue: d(weekday), wed: d(weekday), thu: d(weekday), fri: d(fri), sat: d(sat), sun: d(sun) };
};

/** Exact copies of the templates seed_hours.ts used to write. */
const TEMPLATES: Record<string, OpenHours> = {
    nightlife: week(['17:00', '02:00'], ['16:00', '03:00'], ['16:00', '03:00'], ['16:00', '02:00']),
    restaurant: week(['11:00', '22:00'], ['11:00', '23:00'], ['10:00', '23:00'], ['10:00', '22:00']),
    cafe: week(['07:00', '15:00'], ['07:00', '15:00'], ['08:00', '16:00'], ['08:00', '16:00']),
    generic: week(['09:00', '21:00'], ['09:00', '22:00'], ['09:00', '22:00'], ['10:00', '20:00']),
};

/** Both old scripts generated descriptions with this shape. */
const GENERATED_DESCRIPTION = /\bis an? (Top-rated|High-quality|Exceptional|Popular|Well-loved|Local) destination in Chicago \(/;

/** Old Google script stored closed days as { isOpen: false, open: null, close: null }. */
function repairHours(raw: unknown): OpenHours | null {
    if (!raw || typeof raw !== 'object') return null;
    const out: Record<string, unknown> = {};
    for (const day of DAY_KEYS) {
        const v = (raw as Record<string, { isOpen?: boolean; open?: unknown; close?: unknown }>)[day];
        if (!v) continue;
        if (!v.isOpen) out[day] = { ...CLOSED_DAY };
        else if (typeof v.open === 'string' && typeof v.close === 'string') out[day] = { isOpen: true, open: v.open, close: v.close };
        else return null; // "open" with no times — can't trust any of it
    }
    const parsed = OpenHoursSchema.safeParse(out);
    return parsed.success ? parsed.data : null;
}

async function main() {
    const locations = await prisma.location.findMany({ orderBy: { id: 'asc' } });
    const counts = { templateHours: 0, repairedHours: 0, unreadableHours: 0, generatedDescriptions: 0, estimatedPrices: 0, unverifiedGoogleIds: 0 };
    const at = new Date().toISOString();

    for (const loc of locations) {
        const data: Prisma.LocationUpdateInput = {};
        const sources: FieldSources = { ...((loc.fieldSources as FieldSources | null) ?? {}) };
        const notes: string[] = [];

        if (loc.openHours) {
            const template = Object.entries(TEMPLATES).find(([, t]) => deepEqual(t, loc.openHours))?.[0];
            if (template) {
                counts.templateHours++;
                notes.push(`template "${template}" hours removed`);
                data.openHours = Prisma.DbNull;
                delete sources.openHours;
                if (loc.avgCost !== null && sources.avgCost?.source !== 'manual') {
                    counts.estimatedPrices++;
                    sources.avgCost = { source: 'estimate', at };
                    notes.push('price marked as an estimate');
                }
            } else if (!OpenHoursSchema.safeParse(loc.openHours).success) {
                const repaired = repairHours(loc.openHours);
                if (repaired) {
                    counts.repairedHours++;
                    notes.push('hours repaired');
                    data.openHours = repaired as Prisma.InputJsonValue;
                } else {
                    counts.unreadableHours++;
                    notes.push('unreadable hours removed');
                    data.openHours = Prisma.DbNull;
                }
            }
        }

        if (loc.description && GENERATED_DESCRIPTION.test(loc.description)) {
            counts.generatedDescriptions++;
            notes.push('generated description removed');
            data.description = null;
            delete sources.description;
        }

        if (loc.googlePlaceId && loc.matchStatus === 'unmatched') {
            // Old script took the first search result without checking location; re-verify on next enrichment.
            counts.unverifiedGoogleIds++;
        }

        if (notes.length) {
            console.log(`[${loc.id}] ${loc.name}: ${notes.join('; ')}`);
            if (FIX) await prisma.location.update({ where: { id: loc.id }, data: { ...data, fieldSources: sources as Prisma.InputJsonValue } });
        }
    }

    console.log(`\n${locations.length} locations checked${FIX ? ' — fixes applied' : ' — report only (run with --fix to apply)'}`);
    console.log(`  template hours:            ${counts.templateHours}`);
    console.log(`  hours repaired:            ${counts.repairedHours}`);
    console.log(`  unreadable hours:          ${counts.unreadableHours}`);
    console.log(`  generated descriptions:    ${counts.generatedDescriptions}`);
    console.log(`  prices marked estimates:   ${counts.estimatedPrices}`);
    console.log(`  unverified Google IDs:     ${counts.unverifiedGoogleIds} (re-checked when you run "Match & enrich")`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
