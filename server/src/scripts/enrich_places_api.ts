
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();
const API_KEY = process.env.GOOGLE_PLACES_KEY;

if (!API_KEY) {
    console.error("ERROR: GOOGLE_PLACES_KEY is missing from environment variables.");
    process.exit(1);
}

// Helper: Delay to respect rate limits
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: Parse Google Hours into our Schema format
function parseGoogleHours(periods: any[], weekdayText: string[]) {
    // Our target format: { mon: { open: "17:00", close: "02:00", isOpen: true }, ... }
    // Google format: periods: [{ open: { day: 0, time: "1700" }, close: { ... } }] (0=Sunday)

    if (!periods) return null;

    const daysMap = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const result: any = {};

    // Initialize all as closed
    daysMap.forEach(d => result[d] = { isOpen: false, open: null, close: null });

    periods.forEach((p: any) => {
        if (p.open && p.close) {
            const dayName = daysMap[p.open.day]; // 0 = Sunday
            const openTime = `${p.open.time.substring(0, 2)}:${p.open.time.substring(2)}`;
            const closeTime = `${p.close.time.substring(0, 2)}:${p.close.time.substring(2)}`;

            result[dayName] = {
                isOpen: true,
                open: openTime,
                close: closeTime
            };
        } else if (p.open && !p.close && p.open.time === "0000") {
            // 24 Hours?
            const dayName = daysMap[p.open.day];
            result[dayName] = { isOpen: true, open: "00:00", close: "23:59" };
        }
    });

    return result;
}

async function findPlaceId(name: string, city = "Chicago, IL"): Promise<string | null> {
    try {
        const query = `${name} ${city}`;
        console.log(`  🔍 Searching for: "${query}"...`);

        const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id,name,formatted_address,geometry&key=${API_KEY}`;

        const res = await axios.get(url);

        if (res.data.status === 'OK' && res.data.candidates.length > 0) {
            // Simple heuristic: just take the first one. 
            // In future we can check geometry distance if we have lat/lng.
            const candidate = res.data.candidates[0];
            console.log(`    -> Found: ${candidate.name} (${candidate.formatted_address})`);
            return candidate.place_id;
        } else {
            console.log(`    -> No candidates found (Status: ${res.data.status})`);
            return null;
        }
    } catch (error) {
        console.error(`    -> Error finding place: ${(error as Error).message}`);
        return null;
    }
}

async function getPlaceDetails(placeId: string) {
    try {
        const fields = 'name,formatted_phone_number,website,opening_hours,rating,user_ratings_total,photos';
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${API_KEY}`;

        const res = await axios.get(url);

        if (res.data.status === 'OK') {
            return res.data.result;
        } else {
            console.log(`    -> Details failed (Status: ${res.data.status})`);
            return null;
        }
    } catch (error) {
        console.error(`    -> Error getting details: ${(error as Error).message}`);
        return null;
    }
}

async function run() {
    console.log("🚀 Starting Google Places Enrichment...");

    // 1. Get Locations (Prioritize those with NO website or NO hours)
    // Also include those with googlePlaceId = null to catch new ones
    const locations = await prisma.location.findMany({
        where: {
            OR: [
                { googlePlaceId: null },
                { website: null },
                { openHours: { equals: Prisma.DbNull } } // Approximate check for empty JSON
            ]
        },
        orderBy: { id: 'asc' }
    });

    console.log(`Found ${locations.length} locations to check.`);

    let enrichedCount = 0;
    let failedCount = 0;

    for (const loc of locations) {
        console.log(`\n[${loc.id}] Processing: ${loc.name}`);

        // 2. Find Place ID (if missing)
        let placeId = loc.googlePlaceId;
        if (!placeId) {
            placeId = await findPlaceId(loc.name);
            if (!placeId) {
                failedCount++;
                continue;
            }
            // Save Place ID immediately
            await prisma.location.update({
                where: { id: loc.id },
                data: { googlePlaceId: placeId }
            });
        }

        // 3. Get Details
        const details = await getPlaceDetails(placeId);
        if (!details) {
            failedCount++;
            continue;
        }

        // 4. Prepare Updates
        const updates: any = {};

        if (details.formatted_phone_number) updates.phoneNumber = details.formatted_phone_number;
        if (details.website) updates.website = details.website;
        if (details.rating) updates.rating = details.rating;
        if (details.user_ratings_total) updates.reviewCount = details.user_ratings_total;

        if (details.opening_hours && details.opening_hours.periods) {
            const parsedHours = parseGoogleHours(details.opening_hours.periods, details.opening_hours.weekday_text);
            if (parsedHours) updates.openHours = parsedHours;
        }

        // Only update if we have something
        if (Object.keys(updates).length > 0) {
            await prisma.location.update({
                where: { id: loc.id },
                data: updates
            });
            console.log(`    ✅ Enriched: ${Object.keys(updates).join(', ')}`);
            enrichedCount++;
        } else {
            console.log("    -> No new data to update.");
        }

        // Rate Limit Guard (approx 10 QPS allowed, but let's be safe)
        await delay(200);
    }

    console.log(`\n--- SUMMARY ---`);
    console.log(`Processed: ${locations.length}`);
    console.log(`Enriched: ${enrichedCount}`);
    console.log(`Failed/No Match: ${failedCount}`);
    await prisma.$disconnect();
}

// Fix for Prisma 'DbNull' used in value position
import { Prisma } from '@prisma/client';

run();
