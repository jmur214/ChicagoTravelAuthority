
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Attempting to connect to DB...");
    try {
        const locations = await prisma.location.findMany({
            include: { tags: { include: { tag: true } } }
        });
        console.log(`Success! Found ${locations.length} locations.`);
    } catch (e) {
        console.error("FATAL PRISMA ERROR:");
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
