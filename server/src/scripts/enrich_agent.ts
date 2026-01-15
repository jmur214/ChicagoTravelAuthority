// @ts-nocheck
import puppeteer from 'puppeteer';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function delay(time: number) {
    return new Promise(resolve => setTimeout(resolve, time));
}

// Map Yelp Price ($) to Int (1-4)
function mapPrice(priceStr?: string): number {
    if (!priceStr) return 2;
    return priceStr.length; // "$$" -> 2
}

// Parse Yelp/Schema.org hours to our format
function parseSchemaHours(specs: any[]) {
    const hours: any = {
        mon: { isOpen: false, open: "00:00", close: "00:00" },
        tue: { isOpen: false, open: "00:00", close: "00:00" },
        wed: { isOpen: false, open: "00:00", close: "00:00" },
        thu: { isOpen: false, open: "00:00", close: "00:00" },
        fri: { isOpen: false, open: "00:00", close: "00:00" },
        sat: { isOpen: false, open: "00:00", close: "00:00" },
        sun: { isOpen: false, open: "00:00", close: "00:00" },
    };

    const dayMap: Record<string, string> = {
        "Monday": "mon", "Tuesday": "tue", "Wednesday": "wed",
        "Thursday": "thu", "Friday": "fri", "Saturday": "sat", "Sunday": "sun"
    };

    if (!Array.isArray(specs)) return null;

    for (const spec of specs) {
        // spec example: { "@type": "OpeningHoursSpecification", "dayOfWeek": ["Monday"], "opens": "11:00", "closes": "23:00" }
        // or dayOfWeek string "Monday"
        const days = Array.isArray(spec.dayOfWeek) ? spec.dayOfWeek : [spec.dayOfWeek];

        for (const d of days) {
            const dayKey = dayMap[d];
            if (dayKey && spec.opens && spec.closes) {
                hours[dayKey] = {
                    isOpen: true,
                    open: spec.opens,
                    close: spec.closes
                };
            }
        }
    }
    return hours;
}

// Smart Description Generator (Template-based AI simulation)
function generateDescription(loc: any, data: any, schemaHours: any) {
    // If existing description is already long/detailed, keep it (unless it's null or generic)
    if (loc.description && loc.description.length > 50) return loc.description;

    const rating = data.aggregateRating?.ratingValue;
    const reviewCount = data.aggregateRating?.reviewCount;
    const price = data.priceRange;

    if (!rating || !reviewCount) return loc.description;

    const adjectives = parseFloat(rating) >= 4.5 ? ["Top-rated", "High-quality", "Exceptional"] : ["Popular", "Well-loved", "Local"];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const verifiedStatus = "Verified info";

    let closingText = "";
    if (schemaHours && schemaHours.fri && schemaHours.fri.isOpen) {
        closingText = `Open until ${schemaHours.fri.close} on Fridays.`;
    }

    const priceText = price ? `Price: ${price}.` : "";

    // "Au Cheval is a Top-rated Chicago spot with 4.8 stars and 5000+ reviews. Price: $$. Open until 00:00 on Fridays."
    return `${loc.name} is a ${adj} destination in Chicago (${rating} stars, ${reviewCount} reviews). ${priceText} ${closingText} Check out their amenities and latest updates online.`;
}

async function run() {
    console.log("Starting Enrichment Agent... [VERSION 2.0 - Try-Link Logic]");

    // Check for specific target argument or Flags
    const args = process.argv.slice(2);
    const targetName = args.find(a => !a.startsWith('--'));
    const runAll = args.includes('--all');

    let whereClause: any = {};
    if (targetName) {
        console.log(`TARGET MODE: Enriching single location containing "${targetName}"...`);
        whereClause = { name: { contains: targetName, mode: 'insensitive' } };
    } else {
        // Default: just 1 location for testing unless --all is passed
        if (!runAll) {
            console.log("TEST MODE: Processing 1 location. Run with --all to process everything.");
        }
    }

    const locations = await prisma.location.findMany({
        where: whereClause,
        take: (targetName || runAll) ? undefined : 1
    });

    console.log(`Found ${locations.length} locations to enrich.`);
    if (locations.length === 0) return;

    const browser = await puppeteer.launch({
        headless: false, // Run VISIBLE
        defaultViewport: null,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized']
    });
    const page = await browser.newPage();

    // Set User Agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36');

    // Helper for manual pause
    const waitForEnter = async () => {
        console.log("--> PAUSED: Please solve any CAPTCHA in the browser window.");
        console.log("--> Press ENTER in this terminal when the page is ready...");
        await new Promise(resolve => {
            process.stdin.once('data', () => resolve(null));
        });
    };

    let firstRun = true;

    // Directory Blocklist (to find the 'Official' site)
    const BLOCKLIST = [
        'yelp.com', 'tripadvisor.com', 'facebook.com', 'instagram.com',
        'opentable.com', 'resy.com', 'ubereats.com', 'grubhub.com',
        'doordash.com', 'foursquare.com', 'mapquest.com', 'yellowpages.com',
        'chicago.eater.com', 'theinfatuation.com', 'timeout.com', 'choosechicago.com',
        'wikipedia.org', 'google.com' // Explicitly block google main domains
    ];

    const missingLog: string[] = [];

    for (const loc of locations) {
        try {
            console.log(`\nProcessing: ${loc.name}...`);
            await delay(1500 + Math.random() * 1000);

            // 1. Search Bing (More scraper friendly)
            // Query: Name + Address + "IL" (Anchor to state)
            let queryStr = `"${loc.name}" Chicago IL`;
            if (loc.zip) queryStr += ` ${loc.zip}`;

            const query = encodeURIComponent(queryStr);
            console.log(`    - Searching Bing for: "${queryStr}"`);
            await page.goto(`https://www.bing.com/search?q=${query}`, { waitUntil: 'domcontentloaded' });

            if (firstRun) {
                await waitForEnter();
                firstRun = false;
            }

            // 2. Find Candidate Links (Aggressive + Smart Decode)
            let candidates: string[] = [];
            let strategy = "Aggressive Extraction";

            try {
                // Get all relevant links from the results block
                // Revert to aggressive selector to capture Local Pack / Sidebar links which are often best
                const links = await page.evaluate(() => {
                    const anchors = Array.from(document.querySelectorAll('#b_results a'));
                    return anchors
                        .map(a => (a as HTMLAnchorElement).href)
                        .filter(href => href && href.startsWith('http') && !href.includes('microsoft.com') && !href.includes('bing.com/search'));
                });

                // Unique & Filter & Decode
                const uniqueLinks = Array.from(new Set(links));

                // Debug: Print found domains
                if (uniqueLinks.length > 0) {
                    const domains = uniqueLinks.map(l => {
                        try { return new URL(l).hostname; } catch (e) { return ""; }
                    }).filter(d => d).slice(0, 10).join(', ');
                    console.log(`      [Debug] Found Domains: ${domains}...`);
                }

                for (const link of uniqueLinks) {
                    if (candidates.length >= 15) break;

                    // Debug Raw Link (First 5 only to reduce spam)
                    if (candidates.length < 5) console.log(`      [Debug] Raw Link: ${link.substring(0, 60)}...`);

                    // DECODE BING REDIRECTS (u parameter)
                    // Format: https://www.bing.com/ck/a?!...&u=a1aHR0cHM6Ly9...&ntb=1
                    if (link.includes('bing.com/ck/a')) {
                        const uMatch = link.match(/&u=a1([^&]+)/);
                        if (uMatch && uMatch[1]) {
                            try {
                                // Base64Url safe decode
                                const base64 = uMatch[1].replace(/-/g, '+').replace(/_/g, '/');
                                const decoded = atob(base64);
                                console.log(`      [Refined] Decoded: ${decoded}`);
                                candidates.push(decoded);
                            } catch (e) {
                                console.log(`      [Refined] Decode Failed: ${(e as Error).message}`);
                                candidates.push(link);
                            }
                        } else {
                            console.log(`      [Refined] No u=a1 parameter found in Bing link.`);
                            candidates.push(link);
                        }
                    } else {
                        candidates.push(link);
                    }
                }

                // --- RELEVANCE SORTING ---
                const cleanName = loc.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                candidates.sort((a, b) => {
                    const domainA = new URL(a).hostname.toLowerCase();
                    const domainB = new URL(b).hostname.toLowerCase();

                    // 1. Domain Match
                    const scoreA_Name = domainA.includes(cleanName) ? 5 : 0;
                    const scoreB_Name = domainB.includes(cleanName) ? 5 : 0;

                    // 2. Penalize Generic but keep Aggregators accessible (just scored lower than official)
                    const penalize = (d: string) => {
                        if (d.includes('wikipedia')) return -10;
                        if (d.includes('yelp')) return -3;
                        if (d.includes('tripadvisor')) return -3;
                        if (d.includes('facebook')) return -2;
                        return 0;
                    };

                    return (scoreB_Name + penalize(domainB)) - (scoreA_Name + penalize(domainA));
                });

                console.log(`    - Found ${candidates.length} candidates (Strategy: ${strategy})`);

            } catch (e) {
                console.log(`  - Error finding links: ${(e as Error).message}`);
            }

            if (candidates.length === 0) {
                console.log("  - No candidates found.");
                missingLog.push(`${loc.name}: No Search Results`);
                continue;
            }

            // 3. Try Candidates
            let success = false;
            let fallbackCandidate: { url: string, score: number, reasons: string[] } | null = null; // Store best aggregator if no official site found

            for (const targetUrl of candidates) {
                let preDomain = "";
                try { preDomain = new URL(targetUrl).hostname; } catch (e) { }

                const isAggregator = preDomain.includes('yelp.com') || preDomain.includes('tripadvisor.com') || preDomain.includes('facebook.com');
                const isBlocked = !isAggregator && BLOCKLIST.some(blocked => preDomain.includes(blocked) && !blocked.includes('yelp') && !blocked.includes('facebook'));

                if (!targetUrl.includes('bing.com') && isBlocked) {
                    continue;
                }

                console.log(`    - Trying: ${targetUrl.substring(0, 50)}...`);

                try {
                    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
                    await delay(1000);

                    // --- CONTENT VALIDATION (WEIGHTED SCORING) ---
                    let siteData: any = null;
                    let retries = 0;
                    while (retries < 2 && !siteData) {
                        try {
                            siteData = await page.evaluate((data) => {
                                const { locName, locPhone, locCity } = data;
                                const text = document.body.innerText.toLowerCase();
                                const title = document.title.toLowerCase();
                                const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content') || "";

                                // SCORING SYSTEM
                                let score = 0;
                                const reasons: string[] = [];

                                // 1. PHONE MATCH (The Golden Ticket) (+5)
                                if (locPhone) {
                                    const last4 = locPhone.slice(-4);
                                    if (text.includes(last4) || title.includes(last4)) {
                                        score += 5;
                                        reasons.push("Phone Match");
                                    }
                                }

                                // 2. Geographic Relevance (+3)
                                const geoMarkers = ['chicago', 'illinois', ' il ', ', il', 'evanston', 'oak park', 'skokie', '606'];
                                if (geoMarkers.some(g => text.includes(g) || title.includes(g))) {
                                    score += 3;
                                    reasons.push("Geo Match");
                                }

                                // 3. Name Relevance (+3)
                                const nameParts = locName.toLowerCase().split(' ').filter((p: string) => p.length > 3 && p !== 'restaurant' && p !== 'chicago' && p !== 'cafe');
                                const matchesName = nameParts.some((p: string) => title.includes(p));
                                if (matchesName) {
                                    score += 3;
                                    reasons.push("Name Match");
                                }

                                // 4. Business Context (+2)
                                const contextKeywords = ['menu', 'hours', 'contact', 'reservations', 'gallery', 'shop', 'cart', 'about us'];
                                if (contextKeywords.some(k => text.includes(k))) {
                                    score += 2;
                                    reasons.push("Business Context");
                                }

                                // 5. NEGATIVE Signals (The "Rodney Alcala" Filter) (-10)
                                const negativeKeywords = ['wikipedia', 'biography', 'crime', 'murder', 'serial killer', 'profile', 'movie', 'film', 'actor', 'lyrics', 'song', 'album', 'band', 'news', 'article', 'report', 'story'];
                                if (negativeKeywords.some(k => title.includes(k) || (text.includes(k) && text.includes('born')))) {
                                    score -= 10;
                                    reasons.push("Negative Content");
                                }
                                if (window.location.hostname.includes('wikipedia')) score -= 10;

                                // Aggregator Penalty (keep them but don't prioritize over official)
                                const host = window.location.hostname;
                                if (host.includes('yelp') || host.includes('tripadvisor') || host.includes('facebook')) {
                                    score -= 2;
                                    reasons.push("Aggregator Penalty");
                                }

                                // Threshold: 6 (Stricter)
                                // Needs Name Match (3) + Geo (3) = 6
                                // Or Phone Match (5) + anything = >6
                                // Geo (3) + Context (2) = 5 (FAIL - prevents random local sites)
                                const isRelevant = score >= 6;

                                if (!isRelevant) {
                                    return { isRelevant: false, score, reasons, reason: `Low Score (${score}): ${reasons.join(', ')}`, isAggregator: host.includes('yelp') || host.includes('tripadvisor') || host.includes('facebook') };
                                }

                                // Extraction Logic
                                const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content');

                                // Schema JSON-LD
                                const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
                                let schemaHours = null;
                                for (const s of scripts) {
                                    try {
                                        const json = JSON.parse(s.innerHTML);
                                        // Try to find hours
                                        if (json.openingHoursSpecification) schemaHours = json.openingHoursSpecification;
                                        if (json['@graph']) {
                                            const biz = json['@graph'].find((n: any) => n.openingHoursSpecification);
                                            if (biz) schemaHours = biz.openingHoursSpecification;
                                        }
                                    } catch (e) { }
                                }

                                const hasHappyHour = text.includes('happy hour');
                                const hasLiveMusic = text.includes('live music');

                                let phone = "";
                                const phoneMatch = text.match(/\(\d{3}\)\s?\d{3}-\d{4}/);
                                if (phoneMatch) phone = phoneMatch[0];

                                let menuUrl = "";
                                const menuLink = document.querySelector('a[href*="menu"]');
                                if (menuLink) menuUrl = (menuLink as HTMLAnchorElement).href;

                                let eventsInfo = "";
                                if (hasHappyHour) eventsInfo += "Happy Hour. ";
                                if (hasLiveMusic) eventsInfo += "Live Music. ";

                                return { isRelevant: true, score, reasons, metaDesc, eventsInfo, menuUrl, phone, ogImage, schemaHours };

                            }, { locName: loc.name, locPhone: loc.phoneNumber, locCity: "Chicago" }); // Assuming config.city is "Chicago"
                        } catch (evalErr) {
                            if ((evalErr as Error).message.includes('Execution context was destroyed')) {
                                retries++;
                                await delay(1000);
                            } else throw evalErr;
                        }
                    }

                    if (!siteData) throw new Error("Evaluation failed");

                    if (!siteData.isRelevant) {
                        console.log(`      [SKIP] Irrelevant (Score ${siteData.score}): ${siteData.reason}`);
                        // If it's an aggregator and we don't have a better fallback, store it
                        if (siteData.isAggregator && (!fallbackCandidate || siteData.score > fallbackCandidate.score)) {
                            fallbackCandidate = { url: page.url(), score: siteData.score, reasons: siteData.reasons };
                        }
                        continue;
                    }

                    console.log(`      -> ACCEPTED (Score ${siteData.score}): ${siteData.reasons.join(', ')}`);
                    const updates: any = { website: page.url() };
                    if (siteData.menuUrl) updates.menuUrl = siteData.menuUrl;
                    if (siteData.eventsInfo) updates.eventsInfo = siteData.eventsInfo;
                    if (siteData.phone) updates.phoneNumber = siteData.phone;
                    if (siteData.ogImage) {
                        const currentMeta = (loc.metadata as any) || {};
                        updates.metadata = { ...currentMeta, imageUrl: siteData.ogImage };
                    }
                    if (siteData.schemaHours) {
                        const parsed = parseSchemaHours(siteData.schemaHours);
                        if (parsed) updates.openHours = parsed;
                    }

                    // Save
                    await prisma.location.update({
                        where: { id: loc.id },
                        data: updates
                    });

                    const status = [];
                    if (updates.openHours) status.push("Hours (Schema)");
                    if (updates.menuUrl) status.push("Menu");
                    if (updates.eventsInfo) status.push("Info/Link");

                    console.log(`      - ENRICHED: ${status.join(', ')}`);
                    success = true;
                    break;

                } catch (err) {
                    console.log(`      - Error: ${(err as Error).message}`);
                }
            } // End Candidate Loop

            if (!success) {
                console.log("  - Could not verify any official website from candidates.");
                if (fallbackCandidate) {
                    console.log(`    - Falling back to best aggregator: ${fallbackCandidate.url} (Score ${fallbackCandidate.score})`);
                    await prisma.location.update({
                        where: { id: loc.id },
                        data: { website: fallbackCandidate.url }
                    });
                    console.log("      - ENRICHED: Website (Fallback Aggregator)");
                } else {
                    missingLog.push(`${loc.name}: All Candidates Failed`);
                }
            }

        } catch (e) {
            console.error(`  - Failed to process ${loc.name}: ${(e as Error).message}`);
            missingLog.push(`${loc.name}: Script Error`);
        }
    } // End Locations loop

    await browser.close();

    if (missingLog.length > 0) {
        console.log("\n--- MISSING DATA REPORT ---");
        console.log(missingLog.join('\n'));
        console.log("---------------------------");
    }
    console.log("Enrichment Complete.");
}

run()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
