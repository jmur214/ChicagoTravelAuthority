import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('Resetting database...');
    // Delete in reverse order of dependencies
    await prisma.locationTag.deleteMany({});
    console.log('Deleted LocationTags');

    await prisma.location.deleteMany({});
    console.log('Deleted Locations');

    await prisma.tag.deleteMany({});
    console.log('Deleted Tags');

    await prisma.tagCategory.deleteMany({});
    console.log('Deleted TagCategories');

    console.log('Database reset complete.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
