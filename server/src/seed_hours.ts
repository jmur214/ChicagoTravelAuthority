
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const HOURS_TEMPLATES = {
    NIGHTLIFE: {
        mon: { open: "17:00", close: "02:00", isOpen: true },
        tue: { open: "17:00", close: "02:00", isOpen: true },
        wed: { open: "17:00", close: "02:00", isOpen: true },
        thu: { open: "17:00", close: "02:00", isOpen: true },
        fri: { open: "16:00", close: "03:00", isOpen: true },
        sat: { open: "16:00", close: "03:00", isOpen: true },
        sun: { open: "16:00", close: "02:00", isOpen: true },
    },
    RESTAURANT: {
        mon: { open: "11:00", close: "22:00", isOpen: true },
        tue: { open: "11:00", close: "22:00", isOpen: true },
        wed: { open: "11:00", close: "22:00", isOpen: true },
        thu: { open: "11:00", close: "22:00", isOpen: true },
        fri: { open: "11:00", close: "23:00", isOpen: true },
        sat: { open: "10:00", close: "23:00", isOpen: true },
        sun: { open: "10:00", close: "22:00", isOpen: true },
    },
    CAFE: {
        mon: { open: "07:00", close: "15:00", isOpen: true },
        tue: { open: "07:00", close: "15:00", isOpen: true },
        wed: { open: "07:00", close: "15:00", isOpen: true },
        thu: { open: "07:00", close: "15:00", isOpen: true },
        fri: { open: "07:00", close: "15:00", isOpen: true },
        sat: { open: "08:00", close: "16:00", isOpen: true },
        sun: { open: "08:00", close: "16:00", isOpen: true },
    },
    GENERIC: {
        mon: { open: "09:00", close: "21:00", isOpen: true },
        tue: { open: "09:00", close: "21:00", isOpen: true },
        wed: { open: "09:00", close: "21:00", isOpen: true },
        thu: { open: "09:00", close: "21:00", isOpen: true },
        fri: { open: "09:00", close: "22:00", isOpen: true },
        sat: { open: "09:00", close: "22:00", isOpen: true },
        sun: { open: "10:00", close: "20:00", isOpen: true },
    }
};

async function seedHours() {
    const locations = await prisma.location.findMany({
        include: { tags: { include: { tag: true } } }
    });

    console.log(`Found ${locations.length} locations to check/update.`);

    for (const loc of locations) {
        // Simple heuristic based on tag names
        const tagNames = loc.tags.map(t => t.tag.name.toLowerCase());

        // Skip if already has hours (comment out if force update desired)
        // if (loc.openHours) continue;

        let template = HOURS_TEMPLATES.GENERIC;
        let stay = 60;
        let cost = 1;

        if (tagNames.some(t => t.includes('bar') || t.includes('cocktail') || t.includes('club') || t.includes('pub') || t.includes('music'))) {
            template = HOURS_TEMPLATES.NIGHTLIFE;
            stay = 120;
            cost = 2;
        } else if (tagNames.some(t => t.includes('coffee') || t.includes('cafe') || t.includes('bakery'))) {
            template = HOURS_TEMPLATES.CAFE;
            stay = 45;
            cost = 1;
        } else if (tagNames.some(t => t.includes('restaurant') || t.includes('food') || t.includes('dinner'))) {
            template = HOURS_TEMPLATES.RESTAURANT;
            stay = 90;
            cost = 3;
        }

        // Apply Update
        // Only update if missing fields to avoid overwriting custom data? 
        // For now, FORCE update openHours if null, but update stay/cost if likely default.

        await prisma.location.update({
            where: { id: loc.id },
            data: {
                openHours: loc.openHours || template,
                avgStayMinutes: loc.avgStayMinutes === 0 ? stay : loc.avgStayMinutes,
                avgCost: loc.avgCost === 0 || loc.avgCost === null ? cost : loc.avgCost
            }
        });
        console.log(`Updated ${loc.name} -> Template Applied.`);
    }
}

seedHours()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
