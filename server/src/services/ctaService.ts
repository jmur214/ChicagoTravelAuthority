import axios from 'axios';

interface Train {
    id: string; // run number
    route: string; // R, B, etc.
    lat: number;
    lon: number;
    heading: number;
    destination: string;
    lastUpdate: string;
    isMock?: boolean;
}

interface CTASnapshot {
    generatedAt: string;
    trains: Train[];
}

export class CTAService {
    private apiKey: string | undefined;
    private latestSnapshot: CTASnapshot | null = null;
    private pollingInterval: NodeJS.Timeout | null = null;
    // Use standard CTA route identifiers (Title Case usually preferred, checking doc Appendix)
    // 'Pink' is often 'Pink' or 'Pnk'. 'Pnk' failed in logs with 106. trying 'Pink'.
    // If 'Pink' fails, we might need to remove it or try 'pink'. 
    // Verified 'Red' works.
    private readonly ROUTES = ['Red', 'Blue', 'Brn', 'G', 'Org', 'Pink', 'P', 'Y'];

    constructor() {
        this.apiKey = process.env.CTA_TRAIN_API_KEY;
        if (!this.apiKey) {
            console.warn("⚠️ No CTA_TRAIN_API_KEY found. Using MOCK data mode.");
        }
    }

    public startPolling(intervalMs: number = 20000) {
        this.poll(); // Initial poll
        this.pollingInterval = setInterval(() => this.poll(), intervalMs);
        console.log(`[CTAService] Started polling every ${intervalMs}ms`);
    }

    public stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    public getLatestSnapshot(): CTASnapshot {
        // If we have no data yet (or failed to fetch), return empty or mock
        if (!this.latestSnapshot && !this.apiKey) {
            return this.generateMockSnapshot();
        }
        return this.latestSnapshot || { generatedAt: new Date().toISOString(), trains: [] };
    }

    private async poll() {
        if (!this.apiKey) {
            this.latestSnapshot = this.generateMockSnapshot();
            return;
        }

        try {
            // Can fetch multiple routes at once: rt=red,blue,brn
            // Note: CTA API might limit number of routes or chars. 
            // The guide suggests comma-separated.
            const routeString = this.ROUTES.join(',');
            const url = `http://lapi.transitchicago.com/api/1.0/ttpositions.aspx?key=${this.apiKey}&rt=${routeString}&outputType=JSON`;

            const response = await axios.get(url);

            // Expected structure based on guide/docs:
            // { "ctatt": { "route": [ { "@name": "red", "train": [...] }, ... ] } }
            // Or flat list depending on API version. 
            // We'll need to strictly parse what comes back. 
            // For now, let's assume a standard structure and refine if it fails (logging error).

            const data = response.data?.ctatt;
            if (!data) {
                console.error('[CTAService] Unexpected API response format (no ctatt)');
                return;
            }

            if (data.errCd && data.errCd !== '0') {
                console.error(`[CTAService] API Error ${data.errCd}: ${data.errNm}`);
                return;
            }

            const trains: Train[] = [];

            // data.route could be an array of routes, or a single object if only 1 requested (XML-to-JSON quirk)
            if (data.route) {
                const routes = Array.isArray(data.route) ? data.route : [data.route];

                routes.forEach((r: any) => {
                    const routeName = r['@name']; // e.g. "red"
                    const trainList = r.train;

                    if (trainList) {
                        const tArray = Array.isArray(trainList) ? trainList : [trainList];
                        tArray.forEach((t: any) => {
                            trains.push({
                                id: t.rn, // Run number
                                route: routeName,
                                lat: parseFloat(t.lat),
                                lon: parseFloat(t.lon),
                                heading: parseInt(t.heading, 10),
                                destination: t.destNm,
                                lastUpdate: t.prdt // Predictable timestamp
                            });
                        });
                    }
                });
            }

            this.latestSnapshot = {
                generatedAt: new Date().toISOString(),
                trains
            };

            // console.log(`[CTAService] Fetched ${trains.length} trains.`);

        } catch (error) {
            console.error('[CTAService] Poll failed:', error instanceof Error ? error.message : error);
            // Keep old snapshot if available
        }
    }

    private generateMockSnapshot(): CTASnapshot {
        // Generate some realistic-looking trains for dev/demo
        const now = Date.now();
        const baseTrains = [
            { id: '101', route: 'red', lat: 41.895 + Math.sin(now / 5000) * 0.01, lon: -87.625, heading: 0, destination: 'Howard' },
            { id: '102', route: 'red', lat: 41.860 - Math.sin(now / 5000) * 0.01, lon: -87.625, heading: 180, destination: '95th' },
            { id: '201', route: 'blue', lat: 41.900, lon: -87.660 + Math.cos(now / 6000) * 0.01, heading: 270, destination: 'O\'Hare' }
        ];

        return {
            generatedAt: new Date().toISOString(),
            trains: baseTrains.map(t => ({
                ...t,
                lastUpdate: new Date().toISOString(),
                isMock: true
            }))
        };
    }
}

export const ctaService = new CTAService();
