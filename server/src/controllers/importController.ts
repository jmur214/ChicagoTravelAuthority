import { Request, Response } from 'express';
import prisma from '../prismaClient';
import { KmlService } from '../services/kmlService';
import { TagService } from '../services/tagService';

const kmlService = new KmlService();
const tagService = new TagService();

export const getLocations = async (req: Request, res: Response) => {
    try {
        const includeAll = req.query.all === 'true';
        const where = includeAll ? {} : { isConfirmed: true };

        const locations = await prisma.location.findMany({
            where,
            include: {
                tags: { include: { tag: true } },
                categories: true
            }
        });
        res.json(locations);
    } catch (error) {
        console.error("fetch error", error);
        res.status(500).json({ error: 'Failed to fetch locations' });
    }
};

export const createLocation = async (req: Request, res: Response) => {
    try {
        const { name, description, latitude, longitude, tags, categories, avgCost, avgStayMinutes, openHours, website, menuUrl, eventsInfo } = req.body;

        if (!name || isNaN(parseFloat(latitude)) || isNaN(parseFloat(longitude))) {
            res.status(400).json({ error: 'Name, latitude, and longitude are required' });
            return;
        }

        const location = await prisma.location.create({
            data: {
                name,
                description,
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude),
                avgCost: avgCost ? parseInt(avgCost) : 1,
                avgStayMinutes: avgStayMinutes ? parseInt(avgStayMinutes) : 90,
                openHours: openHours || undefined,
                website,
                menuUrl,
                eventsInfo,
                tags: {
                    create: tags?.map((t: any) => ({
                        tag: { connect: { id: t } } // tags is array of IDs
                    }))
                },
                categories: categories ? {
                    connect: categories.map((id: number) => ({ id: Number(id) }))
                } : undefined
            },
            include: {
                tags: { include: { tag: true } },
                categories: true
            }
        });
        res.json(location);
    } catch (error) {
        console.error('Create error:', error);
        res.status(500).json({ error: 'Failed to create location' });
    }
};

export const updateLocation = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, description, latitude, longitude, tags, categories, avgCost, avgStayMinutes, openHours } = req.body; // categories = array of IDs

        // Transaction to handle tag updates (delete old, add new)
        const location = await prisma.$transaction(async (tx) => {
            // Update basic fields & categories
            const updated = await tx.location.update({
                where: { id: Number(id) },
                data: {
                    name,
                    description,
                    latitude: Number(latitude),
                    longitude: Number(longitude),
                    avgCost: avgCost ? Number(avgCost) : undefined,
                    avgStayMinutes: avgStayMinutes ? Number(avgStayMinutes) : undefined,
                    openHours: openHours || undefined,

                    // Categories: Replace all (Implicit M2M)
                    categories: categories ? {
                        set: categories.map((cId: number) => ({ id: Number(cId) }))
                    } : undefined
                }
            });

            if (tags) {
                // Explicit M2M for tags (LocationTag model) requires manual delete/create
                await tx.locationTag.deleteMany({ where: { locationId: Number(id) } });
                await tx.locationTag.createMany({
                    data: tags.map((tagId: number) => ({
                        locationId: Number(id),
                        tagId: Number(tagId)
                    }))
                });
            }

            return tx.location.findUnique({
                where: { id: Number(id) },
                include: {
                    tags: { include: { tag: true } },
                    categories: true
                }
            });
        });

        res.json(location);
    } catch (error) {
        console.error('Update error:', error);
        res.status(500).json({ error: 'Failed to update location' });
    }
};

export const deleteLocation = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.location.delete({ where: { id: Number(id) } });
        res.json({ success: true });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ error: 'Failed to delete location' });
    }
};
export const importKml = async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const kmlContent = req.file.buffer.toString('utf-8');
        const parsedPlaces = kmlService.parseKml(kmlContent);

        const results = {
            total: parsedPlaces.length,
            imported: 0,
            errors: 0
        };

        for (const place of parsedPlaces) {
            try {
                // 1. Flatten all folders into tags
                const allTags = [...place.folderPath];
                // Filter out generic root folders if needed, but user wants everything.
                // analyzing specific known tags can still be useful for categories, 
                // but we should ensure ALL folders become tags.

                const tagsToConnect: { id: number }[] = [];

                const ensureTag = async (name: string, categoryName: string) => {
                    // Find or create category
                    const category = await prisma.tagCategory.upsert({
                        where: { name: categoryName },
                        update: {},
                        create: { name: categoryName }
                    });

                    // Find or create tag
                    const tag = await prisma.tag.upsert({
                        where: { name },
                        update: {},
                        create: {
                            name,
                            categories: { connect: { id: category.id } } // M2M connect
                        }
                    });
                    return tag;
                };

                // Process all folder names as tags
                for (const folder of allTags) {
                    if (folder === 'My Places' || folder === 'What to do?') continue; // Skip root noise
                    const t = await ensureTag(folder, 'Folder');
                    tagsToConnect.push({ id: t.id });
                }

                // 3. Upsert Location
                // Check if exists by Name + approx Lat/Lng (to handle small precision diffs, we can just use exact for now or ranges)
                // Or just Name + Lat + Lng.

                const existing = await prisma.location.findFirst({
                    where: {
                        name: place.name,
                        AND: [
                            { latitude: { gte: place.latitude - 0.0001, lte: place.latitude + 0.0001 } },
                            { longitude: { gte: place.longitude - 0.0001, lte: place.longitude + 0.0001 } }
                        ]
                    }
                });

                if (existing) {
                    // Update existing location's tags if needed, or just skip?
                    // Let's update tags to ensure we capture new KML structure
                    await prisma.locationTag.createMany({
                        data: tagsToConnect.map(t => ({ locationId: existing.id, tagId: t.id })),
                        skipDuplicates: true
                    });
                    // Update metadata
                    await prisma.location.update({
                        where: { id: existing.id },
                        data: {
                            metadata: {
                                originalFolders: place.folderPath,
                                unverifiedTags: []
                            }
                        }
                    });
                } else {
                    await prisma.location.create({
                        data: {
                            name: place.name,
                            description: place.description,
                            latitude: place.latitude,
                            longitude: place.longitude,
                            metadata: {
                                originalFolders: place.folderPath,
                                unverifiedTags: []
                            },
                            tags: {
                                create: tagsToConnect.map(t => ({ tag: { connect: { id: t.id } } }))
                            }
                        }
                    });
                    results.imported++;
                }
            } catch (err) {
                console.error(`Error importing place ${place.name}: `, err);
                results.errors++;
            }
        }

        res.json({ message: 'Import processed', results });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error during import' });
    }
};
