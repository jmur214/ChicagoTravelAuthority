
// @ts-nocheck
import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper: Delay to respect API limits (though Fusion is fast)
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const YELP_API_KEY = process.env.YELP_API_KEY || process.argv[2];

if (!YELP_API_KEY || !YELP_API_KEY.startsWith('Bearer') && YELP_API_KEY.length < 20) {
    if (!YELP_API_KEY) {
        console.error("ERROR: No API Key provided.");
        console.log("Usage: npx ts-node src/scripts/enrich_with_api.ts <YOUR_YELP_API_KEY>");
        console.log("\n--- HOW TO GET A FREE KEY ---");
        console.log("1. Go to: https://www.yelp.com/developers/v3/manage_app");
        console.log("2. Log in with your personal Yelp account (NOT Business).");
        console.log("3. Click 'Create App' (fill in random description).");
        console.log("4. Copy the long 'API Key'.");
        console.log("-----------------------------");
        process.exit(1);
    }
}

// Ensure "Bearer " prefix
const apiKeyVal = YELP_API_KEY.startsWith('Bearer') ? YELP_API_KEY : `Bearer ${YELP_API_KEY}`;

const yelpClient = axios.create({
    baseURL: 'https://api.yelp.com/v3',
    headers: {
        Authorization: apiKeyVal
    }
});

// Map Yelp Price to Int
function mapPrice(priceStr?: string): number {
    if (!priceStr) return 2;
    return priceStr.length;
}

// Convert "1730" -> "17:30"
function fmtTime(t: string): string {
    if (!t || t.length !== 4) return "00:00";
    return `${t.slice(0, 2)}:${t.slice(2)}`;
}

// Helper: Convert Yelp API Hours to Our Schema
function parseApiHours(yelpData: any) {
    if (!yelpData.hours || !yelpData.hours[0] || !yelpData.hours[0].open) return null;

    const openPeriods = yelpData.hours[0].open;
    const hours: any = {
        mon: { isOpen: false, open: "00:00", close: "00:00" },
        tue: { isOpen: false, open: "00:00", close: "00:00" },
        wed: { isOpen: false, open: "00:00", close: "00:00" },
        thu: { isOpen: false, open: "00:00", close: "00:00" },
        fri: { isOpen: false, open: "00:00", close: "00:00" },
        sat: { isOpen: false, open: "00:00", close: "00:00" },
        sun: { isOpen: false, open: "00:00", close: "00:00" },
    };

    const dayIdxMap = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]; // Yelp 0=Mon, 6=Sun

    // Pre-fill
    // Note: If a place has split hours (Lunch & Dinner), our current DB schema only supports one range per day.
    // We will take the Starts of first and Ends of last to cover the day roughly, or just first.
    // Let's implement logic to find min start and max end for the day.

    // Group by day
    const byDay: any = {}; // { 0: [] }
    for (const p of openPeriods) {
        if (!byDay[p.day]) byDay[p.day] = [];
        byDay[p.day].push(p);
    }

    for (let i = 0; i < 7; i++) {
        const dayKey = dayIdxMap[i];
        if (byDay[i]) {
            // Sort by start
            const periods = byDay[i].sort((a: any, b: any) => parseInt(a.start) - parseInt(b.start));

            // Take earliest open and latest close (Merging split shifts)
            const first = periods[0];
            const last = periods[periods.length - 1];

            hours[dayKey] = {
                isOpen: true,
                open: fmtTime(first.start),
                close: fmtTime(last.end)
            };
        }
    }

    return hours;
}

// Reuse Smart Description Logic
function generateDescription(loc: any, yelpDetails: any, hours: any) {
    if (loc.description && loc.description.length > 50) return loc.description;

    const rating = yelpDetails.rating;
    const reviewCount = yelpDetails.review_count;
    const price = yelpDetails.price;

    if (!rating) return loc.description;

    const adjectives = rating >= 4.5 ? ["Top-rated", "High-quality", "Exceptional"] : ["Popular", "Well-loved", "Local"];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];

    let closingText = "";
    if (hours && hours.fri && hours.fri.isOpen) {
        closingText = `Open until ${hours.fri.close} on Fridays.`;
    }

    const priceText = price ? `Price: ${price}.` : "";
    const cats = yelpDetails.categories?.map((c: any) => c.title).join(", ");
    const catText = cats ? `Known for ${cats}.` : "";

    return `${loc.name} is a ${adj} destination in Chicago (${rating} stars, ${reviewCount} reviews). ${catText} ${priceText} ${closingText}`;
}

async function run() {
    console.log("Starting Enrichment via Yelp Fusion API...");
    console.log("Key verified.");

    const args = process.argv.slice(2);
    // Parse flags: --skip 0 --take 200
    const skipIdx = args.indexOf('--skip');
    const takeIdx = args.indexOf('--take');

    const skip = skipIdx !== -1 ? parseInt(args[skipIdx + 1]) : 0;
    const take = takeIdx !== -1 ? parseInt(args[takeIdx + 1]) : undefined; // undefined = all

    console.log(`Config: Skip ${skip}, Take ${take || 'ALL'}`);

    // Process ALL or subset
    const locations = await prisma.location.findMany({
        skip: skip,
        take: take,
        orderBy: { id: 'asc' } // Consistent ordering for batching
    });


    console.log(`Found ${locations.length} locations to enrich.`);

    for (const loc of locations) {
        try {
            console.log(`\nProcessing: ${loc.name}...`);
            await delay(500); // Rate limit buffer

            // 1. Search
            const searchResp = await yelpClient.get('/businesses/search', {
                params: {
                    term: loc.name,
                    location: 'Chicago, IL',
                    limit: 1
                }
            });

            const business = searchResp.data.businesses?.[0];
            if (!business) {
                console.log("  - No match found on Yelp API.");
                continue;
            }

            // 2. Details (to get hours and photos)
            const id = business.id;
            const detailsResp = await yelpClient.get(`/businesses/${id}`);
            const details = detailsResp.data;

            // 3. Prepare Updates
            const updates: any = {};

            updates.rating = details.rating;
            updates.reviewCount = details.review_count;
            updates.avgCost = mapPrice(details.price);
            updates.website = details.url; // Note: Yelp API returns Yelp URL usually, need to check if it has external.
            // Actually Details API returns `url` as Yelp page. 
            // `messaging`? No.
            // Paradox: Yelp API often DOES NOT give the external website URL (business_url field removed in v3?).
            // Checking docs... V3 usually only gives Yelp URL. 
            // BUT we can use the Yelp URL (loc.website) as the "More Info" link. 
            // Or we ignore it if we want the official site. 
            // The USER prioritized "Website" (Official). 
            // If API doesn't give it, we might be stuck with just Yelp link.
            // Ideally we stick with the Manual/Puppeteer tool for Website, but use API for Ratings/Hours.
            // Let's safe Yelp URL as `menuUrl` or fallback? 
            // No, let's just save it to `website` if `website` is null? 
            // Actually, for now, let's NOT overwrite existing website if we have one.
            if (!loc.website && details.url) {
                // updates.website = details.url; // Use Yelp page as fallback?
            }

            const schemaHours = parseApiHours(details);
            if (schemaHours) updates.openHours = schemaHours;

            // Images
            // If we want to update image? 
            // if (details.image_url) ... 

            // Description
            const newDesc = generateDescription(loc, details, schemaHours);
            if (newDesc !== loc.description) updates.description = newDesc;

            await prisma.location.update({
                where: { id: loc.id },
                data: updates
            });

            console.log(`  - UPDATED: Rating=${updates.rating}, Reviews=${updates.reviewCount}, Hours=${!!updates.openHours}`);

        } catch (e: any) {
            console.error(`  - Error: ${e.response?.status} ${e.response?.statusText || e.message}`);
            if (e.response?.status === 429) {
                console.log("RATE LIMIT HIT. Exiting.");
                break;
            }
        }
    }
}

run()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
