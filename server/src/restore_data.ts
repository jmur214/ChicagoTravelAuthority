import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { KmlService } from './services/kmlService'; // Assuming this exports the class

const prisma = new PrismaClient();
const kmlService = new KmlService();
const KML_PATH = '/Users/jacksonmurphy/Desktop/Projects_2/STD/What to do_.kml';

// Map KML folders to our App Categories
const FOLDER_TO_CATEGORY: Record<string, string> = {
    'Shopping': 'Shopping',
    'Clothes': 'Shopping',
    '2nd hand/thrift': 'Shopping',
    'Bars': 'Nightlife',
    'Cocktails': 'Nightlife',
    'Nightlife': 'Nightlife',
    'Restaurants': 'Food',
    'Food': 'Food',
    'Sightseeing': 'Sightseeing',
    'Culture': 'Culture',
    'Nature': 'Nature',
    'Sports': 'Sports'
};

const STANDARD_CATEGORIES = [
    { name: 'Sightseeing', color: '#00A1DE', shape: 'star' },
    { name: 'Culture', color: '#7B1FA2', shape: 'diamond' },
    { name: 'Nature', color: '#43A047', shape: 'circle' },
    { name: 'Sports', color: '#FDB913', shape: 'circle' },
    { name: 'Nightlife', color: '#E53935', shape: 'wine' },
    { name: 'Shopping', color: '#FB8C00', shape: 'bag' },
    { name: 'Food', color: '#8E24AA', shape: 'utensils' }
];

async function main() {
    console.log(`Reading KML from ${KML_PATH}...`);

    if (!fs.existsSync(KML_PATH)) {
        console.error('KML file not found!');
        process.exit(1);
    }

    console.log('Cleaning database (REVERTING to user KML state)...');
    await prisma.locationTag.deleteMany({});
    await prisma.location.deleteMany({}); // Deletes demo data
    await prisma.tag.deleteMany({});
    await prisma.tagCategory.deleteMany({});

    console.log('Seeding Standard Categories...');
    for (const cat of STANDARD_CATEGORIES) {
        await prisma.tagCategory.create({ data: cat });
    }

    const kmlContent = fs.readFileSync(KML_PATH, 'utf-8');
    const parsedPlaces = kmlService.parseKml(kmlContent);

    console.log(`Found ${parsedPlaces.length} places in KML. Restoring...`);
    let importedCount = 0;

    for (const place of parsedPlaces) {
        const categoriesConnect: { name: string }[] = [];
        const tagsConnect: { name: string }[] = [];

        // Process folders
        for (const folder of place.folderPath) {
            if (['Chicago', 'My Places', 'Legend', 'Other Cities', 'Chicagoland area'].includes(folder)) continue;

            // Check if folder maps to a Category
            const mappedCat = FOLDER_TO_CATEGORY[folder];
            if (mappedCat) {
                // It's a Category
                if (!categoriesConnect.some(c => c.name === mappedCat)) {
                    categoriesConnect.push({ name: mappedCat });
                }
            }

            // ALWAYS treat it as a Tag too (preserves "Clothes", "Thrift" granularity)
            tagsConnect.push({ name: folder });
        }

        // Create Location
        try {
            await prisma.location.create({
                data: {
                    name: place.name,
                    description: place.description || '',
                    latitude: place.latitude,
                    longitude: place.longitude,
                    isConfirmed: true, // Visible on map
                    verifiedVibe: false, // NOT "Vibed Verified" (User request)
                    categories: {
                        connect: categoriesConnect.map(c => ({ name: c.name }))
                    },
                    tags: {
                        create: tagsConnect.map(t => ({
                            tag: {
                                connectOrCreate: {
                                    where: { name: t.name },
                                    create: { name: t.name }
                                }
                            }
                        }))
                    },
                    metadata: {
                        originalFolders: place.folderPath,
                        source: 'KML Restore'
                    }
                }
            });
            importedCount++;
            if (importedCount % 10 === 0) process.stdout.write('.');
        } catch (e) {
            console.error(`\nFailed to import ${place.name}:`, e);
        }
    }

    console.log(`\nRestore complete. Imported ${importedCount} places.`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
