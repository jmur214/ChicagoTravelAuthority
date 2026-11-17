import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const locations = [
    {
        name: "Cloud Gate (The Bean)",
        description: "Iconic stainless steel sculpture reflecting the city's skyline.",
        latitude: 41.8827,
        longitude: -87.6233,
        address: "201 E Randolph St, Chicago, IL 60602",
        website: "https://millenniumpark.org",
        avgCost: 1,
        avgStayMinutes: 30,
        rating: 4.8,
        reviewCount: 25000,
        verifiedVibe: true,
        category: "Sightseeing",
        tags: ["Landmark", "Photo Op", "Free"],
    },
    {
        name: "Navy Pier",
        description: "Historic pier with rides, restaurants, and shops.",
        latitude: 41.8917,
        longitude: -87.6043,
        address: "600 E Grand Ave, Chicago, IL 60611",
        website: "https://navypier.org",
        avgCost: 2,
        avgStayMinutes: 120,
        rating: 4.5,
        reviewCount: 45000,
        verifiedVibe: true,
        category: "Sightseeing",
        tags: ["Family Friendly", "Lake Views", "Ferris Wheel"],
    },
    {
        name: "Art Institute of Chicago",
        description: "World-renowned art museum featuring Impressionist works.",
        latitude: 41.8796,
        longitude: -87.6237,
        address: "111 S Michigan Ave, Chicago, IL 60603",
        website: "https://artic.edu",
        avgCost: 3,
        avgStayMinutes: 180,
        rating: 4.9,
        reviewCount: 32000,
        verifiedVibe: true,
        category: "Culture",
        tags: ["Museum", "Art", "Indoor"],
    },
    {
        name: "Willis Tower Skydeck",
        description: "Observation deck on the 103rd floor with glass boxes.",
        latitude: 41.8789,
        longitude: -87.6359,
        address: "233 S Wacker Dr, Chicago, IL 60606",
        website: "https://theskydeck.com",
        avgCost: 3,
        avgStayMinutes: 90,
        rating: 4.6,
        reviewCount: 18000,
        verifiedVibe: true,
        category: "Sightseeing",
        tags: ["Views", "Landmark", "Tourist"],
    },
    {
        name: "Lincoln Park Zoo",
        description: "Free zoo located within Lincoln Park.",
        latitude: 41.9211,
        longitude: -87.6340,
        address: "2001 N Clark St, Chicago, IL 60614",
        website: "https://lpzoo.org",
        avgCost: 1,
        avgStayMinutes: 120,
        rating: 4.7,
        reviewCount: 21000,
        verifiedVibe: true,
        category: "Nature",
        tags: ["Animals", "Free", "Family Friendly"],
    },
    {
        name: "Wrigley Field",
        description: "Historic baseball park, home of the Chicago Cubs.",
        latitude: 41.9484,
        longitude: -87.6553,
        address: "1060 W Addison St, Chicago, IL 60613",
        website: "https://mlb.com/cubs/ballpark",
        avgCost: 3,
        avgStayMinutes: 180,
        rating: 4.8,
        reviewCount: 30000,
        verifiedVibe: true,
        category: "Sports",
        tags: ["Baseball", "History", "Beer"],
    },
    {
        name: "The Green Mill",
        description: "Legendary jazz club once frequented by Al Capone.",
        latitude: 41.9691,
        longitude: -87.6599,
        address: "4802 N Broadway, Chicago, IL 60640",
        website: "https://greenmilljazz.com",
        avgCost: 2,
        avgStayMinutes: 120,
        rating: 4.7,
        reviewCount: 3500,
        verifiedVibe: true,
        category: "Nightlife",
        tags: ["Jazz", "Live Music", "History", "Cocktails"],
    },
    {
        name: "Chicago Riverwalk",
        description: "Scenic pedestrian path along the Chicago River.",
        latitude: 41.8868,
        longitude: -87.6258,
        address: "Chicago Riverwalk, Chicago, IL 60601",
        website: "https://chicagoriverwalk.us",
        avgCost: 1,
        avgStayMinutes: 60,
        rating: 4.8,
        reviewCount: 12000,
        verifiedVibe: true,
        category: "Sightseeing",
        tags: ["Walk", "Views", "Dining", "Free"],
    },
    {
        name: "Shedd Aquarium",
        description: "Indoor public aquarium with 32,000 animals.",
        latitude: 41.8676,
        longitude: -87.6140,
        address: "1200 S Lake Shore Dr, Chicago, IL 60605",
        website: "https://sheddaquarium.org",
        avgCost: 3,
        avgStayMinutes: 150,
        rating: 4.6,
        reviewCount: 20000,
        verifiedVibe: true,
        category: "Nature",
        tags: ["Marine Life", "Museum", "Family Friendly"],
    },
    {
        name: "Field Museum",
        description: "Natural history museum with Sue the T-Rex.",
        latitude: 41.8663,
        longitude: -87.6170,
        address: "1400 S Lake Shore Dr, Chicago, IL 60605",
        website: "https://fieldmuseum.org",
        avgCost: 3,
        avgStayMinutes: 180,
        rating: 4.8,
        reviewCount: 22000,
        verifiedVibe: true,
        category: "Culture",
        tags: ["History", "Dinosaurs", "Museum"],
    },
    {
        name: "Adler Planetarium",
        description: "America's first planetarium on the lakefront.",
        latitude: 41.8663,
        longitude: -87.6068,
        address: "1300 S Lake Shore Dr, Chicago, IL 60605",
        website: "https://adlerplanetarium.org",
        avgCost: 3,
        avgStayMinutes: 90,
        rating: 4.6,
        reviewCount: 9000,
        verifiedVibe: false,
        category: "Culture",
        tags: ["Space", "Science", "Skyline Views"],
    },
    {
        name: "Magnificent Mile",
        description: "Premier commercial district with upscale shops.",
        latitude: 41.8947,
        longitude: -87.6241,
        address: "N Michigan Ave, Chicago, IL 60611",
        website: "https://themagnificentmile.com",
        avgCost: 1,
        avgStayMinutes: 120,
        rating: 4.7,
        reviewCount: 15000,
        verifiedVibe: true,
        category: "Shopping",
        tags: ["Shopping", "Walk", "Architecture"],
    },
    {
        name: "Au Cheval",
        description: "Famous diner known for its cheeseburgers.",
        latitude: 41.8847,
        longitude: -87.6477,
        address: "800 W Randolph St, Chicago, IL 60607",
        website: "https://auchevaldiner.com",
        avgCost: 2,
        avgStayMinutes: 90,
        rating: 4.8,
        reviewCount: 8000,
        verifiedVibe: true,
        category: "Food",
        tags: ["Burger", "Late Night", "Popular"],
    },
    {
        name: "Lou Malnati's Pizzeria",
        description: "Deep dish pizza staple in Chicago.",
        latitude: 41.8904,
        longitude: -87.6337,
        address: "439 N Wells St, Chicago, IL 60654",
        website: "https://loumalnatis.com",
        avgCost: 2,
        avgStayMinutes: 75,
        rating: 4.7,
        reviewCount: 11000,
        verifiedVibe: true,
        category: "Food",
        tags: ["Deep Dish", "Pizza", "Casual"],
    },
    {
        name: "The Second City",
        description: "World-famous improv comedy club.",
        latitude: 41.9115,
        longitude: -87.6352,
        address: "1616 N Wells St, Chicago, IL 60614",
        website: "https://secondcity.com",
        avgCost: 3,
        avgStayMinutes: 120,
        rating: 4.8,
        reviewCount: 6000,
        verifiedVibe: true,
        category: "Nightlife",
        tags: ["Comedy", "Show", "Entertainment"],
    },
    {
        name: "The 606",
        description: "Elevated park and trail built on an old rail line.",
        latitude: 41.9138,
        longitude: -87.6830,
        address: "1805 N Ridgeway Ave, Chicago, IL 60647",
        website: "https://the606.org",
        avgCost: 1,
        avgStayMinutes: 60,
        rating: 4.8,
        reviewCount: 4000,
        verifiedVibe: true,
        category: "Nature",
        tags: ["Walk", "Bike", "Outdoor"],
    },
    {
        name: "Portillo's Hot Dogs",
        description: "Chicago-style hot dogs and Italian beef.",
        latitude: 41.8936,
        longitude: -87.6315,
        address: "100 W Ontario St, Chicago, IL 60654",
        website: "https://portillos.com",
        avgCost: 1,
        avgStayMinutes: 45,
        rating: 4.6,
        reviewCount: 15000,
        verifiedVibe: true,
        category: "Food",
        tags: ["Hot Dog", "Italian Beef", "Fast Food"],
    },
    {
        name: "Chicago Cultural Center",
        description: "Stunning building with the world's largest Tiffany dome.",
        latitude: 41.8837,
        longitude: -87.6248,
        address: "78 E Washington St, Chicago, IL 60602",
        website: "https://chicago.gov",
        avgCost: 1,
        avgStayMinutes: 45,
        rating: 4.7,
        reviewCount: 5000,
        verifiedVibe: true,
        category: "Culture",
        tags: ["Architecture", "Free", "Indoor"],
    },
    {
        name: "Kingston Mines",
        description: "Famous blues club with dual stages.",
        latitude: 41.9298,
        longitude: -87.6488,
        address: "2548 N Halsted St, Chicago, IL 60614",
        website: "https://kingstonmines.com",
        avgCost: 2,
        avgStayMinutes: 150,
        rating: 4.6,
        reviewCount: 4500,
        verifiedVibe: true,
        category: "Nightlife",
        tags: ["Blues", "Live Music", "Late Night"],
    },
    {
        name: "360 Chicago",
        description: "Observation deck in the John Hancock Center.",
        latitude: 41.8988,
        longitude: -87.6229,
        address: "875 N Michigan Ave, Chicago, IL 60611",
        website: "https://360chicago.com",
        avgCost: 3,
        avgStayMinutes: 75,
        rating: 4.5,
        reviewCount: 16000,
        verifiedVibe: false,
        category: "Sightseeing",
        tags: ["Views", "Tilt", "Tourist"],
    }
];

async function main() {
    console.log('Resetting database...');
    // Delete in reverse order of dependencies
    await prisma.locationTag.deleteMany({});
    await prisma.location.deleteMany({});
    await prisma.tag.deleteMany({});
    await prisma.tagCategory.deleteMany({});
    console.log('Database reset complete.');

    console.log('Seeding demo data...');

    const categoryColors: { [key: string]: string } = {
        "Sightseeing": "#4f46e5", // Indigo
        "Culture": "#be185d", // Pink
        "Nature": "#059669", // Green
        "Sports": "#dc2626", // Red
        "Nightlife": "#7c3aed", // Violet
        "Shopping": "#d97706", // Amber
        "Food": "#ea580c" // Orange
    };

    const categoryShapes: { [key: string]: string } = {
        "Sightseeing": "circle",
        "Culture": "star",
        "Nature": "diamond",
        "Sports": "circle",
        "Nightlife": "ring",
        "Shopping": "diamond",
        "Food": "star"
    };

    for (const loc of locations) {
        // 1. Create or connect Category
        const category = await prisma.tagCategory.upsert({
            where: { name: loc.category },
            update: {},
            create: {
                name: loc.category,
                color: categoryColors[loc.category] || "#000000",
                shape: categoryShapes[loc.category] || "circle",
            },
        });

        // 2. Create Tags
        const tagConnectOrCreate = loc.tags.map(tagName => ({
            where: { name: tagName },
            create: { name: tagName }
        }));

        // 3. Create Location
        const createdLoc = await prisma.location.create({
            data: {
                name: loc.name,
                description: loc.description,
                latitude: loc.latitude,
                longitude: loc.longitude,
                address: loc.address,
                website: loc.website,
                avgCost: loc.avgCost,
                avgStayMinutes: loc.avgStayMinutes,
                rating: loc.rating,
                reviewCount: loc.reviewCount,
                verifiedVibe: loc.verifiedVibe,
                isConfirmed: true, // IMPORTANT: visible on map
                categories: {
                    connect: { id: category.id }
                },
                tags: {
                    create: loc.tags.map(tagName => ({
                        tag: {
                            connectOrCreate: {
                                where: { name: tagName },
                                create: { name: tagName }
                            }
                        }
                    }))
                }
            }
        });

        console.log(`Created location: ${createdLoc.name}`);
    }

    console.log('Seeding complete.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
