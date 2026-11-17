import AdmZip from 'adm-zip';
import { FOLDER_CATEGORY_NAME, type ImportResult } from '@cta/shared';
import { prisma } from '../lib/prisma';
import { badRequest } from '../lib/httpError';
import { parseKml } from './kmlService';

/** Top-level Google My Maps folders that carry no meaning as tags. */
const IGNORED_FOLDERS = new Set(['My Places', 'What to do?']);

/** Two placemarks with the same name within ~10m are treated as the same place. */
const DUPLICATE_TOLERANCE_DEG = 0.0001;

/** Accepts raw KML or a KMZ (zip containing a .kml). */
export function extractKml(file: Buffer): string {
    const isZip = file.length > 2 && file[0] === 0x50 && file[1] === 0x4b; // "PK"
    if (!isZip) return file.toString('utf-8');

    const entry = new AdmZip(file).getEntries().find(e => e.entryName.toLowerCase().endsWith('.kml'));
    if (!entry) throw badRequest('KMZ archive does not contain a .kml file');
    return entry.getData().toString('utf-8');
}

export async function importKmlFile(file: Buffer): Promise<ImportResult> {
    const places = parseKml(extractKml(file));
    const result: ImportResult = { total: places.length, imported: 0, updated: 0, errors: 0 };

    const folderCategory = await prisma.tagCategory.upsert({
        where: { name: FOLDER_CATEGORY_NAME },
        update: {},
        create: { name: FOLDER_CATEGORY_NAME },
    });

    const tagIdCache = new Map<string, number>();
    const ensureTag = async (name: string): Promise<number> => {
        const cached = tagIdCache.get(name);
        if (cached) return cached;
        const tag = await prisma.tag.upsert({
            where: { name },
            update: {},
            create: { name, categories: { connect: { id: folderCategory.id } } },
        });
        tagIdCache.set(name, tag.id);
        return tag.id;
    };

    for (const place of places) {
        try {
            const tagIds: number[] = [];
            for (const folder of place.folderPath) {
                if (!IGNORED_FOLDERS.has(folder)) tagIds.push(await ensureTag(folder));
            }
            const metadata = { originalFolders: place.folderPath, unverifiedTags: [] };

            const existing = await prisma.location.findFirst({
                where: {
                    name: place.name,
                    latitude: { gte: place.latitude - DUPLICATE_TOLERANCE_DEG, lte: place.latitude + DUPLICATE_TOLERANCE_DEG },
                    longitude: { gte: place.longitude - DUPLICATE_TOLERANCE_DEG, lte: place.longitude + DUPLICATE_TOLERANCE_DEG },
                },
                select: { id: true },
            });

            if (existing) {
                await prisma.$transaction([
                    prisma.locationTag.createMany({
                        data: tagIds.map(tagId => ({ locationId: existing.id, tagId })),
                        skipDuplicates: true,
                    }),
                    prisma.location.update({ where: { id: existing.id }, data: { metadata } }),
                ]);
                result.updated++;
            } else {
                await prisma.location.create({
                    data: {
                        name: place.name,
                        description: place.description,
                        latitude: place.latitude,
                        longitude: place.longitude,
                        metadata,
                        tags: { create: tagIds.map(tagId => ({ tagId })) },
                    },
                });
                result.imported++;
            }
        } catch (err) {
            console.error(`[import] Failed to import "${place.name}":`, err);
            result.errors++;
        }
    }

    return result;
}
