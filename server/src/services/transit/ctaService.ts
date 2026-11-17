import axios from 'axios';
import type { Train, TrainSnapshot } from '@cta/shared';

const CTA_POSITIONS_URL = 'https://lapi.transitchicago.com/api/1.0/ttpositions.aspx';

/** CTA route codes, see the Train Tracker API docs (Appendix). */
const ROUTES = ['Red', 'Blue', 'Brn', 'G', 'Org', 'Pink', 'P', 'Y'];

/** Raw CTA response. The API is XML-converted JSON, so single items may not be arrays. */
interface CtaRawTrain {
    rn: string;
    destNm: string;
    lat: string;
    lon: string;
    heading: string;
    prdt: string;
}
interface CtaRawRoute {
    '@name': string;
    train?: CtaRawTrain | CtaRawTrain[];
}
interface CtaRawResponse {
    ctatt?: {
        errCd?: string;
        errNm?: string | null;
        route?: CtaRawRoute | CtaRawRoute[];
    };
}

const asArray = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

export function parseCtaResponse(body: CtaRawResponse): Train[] {
    const data = body.ctatt;
    if (!data) throw new Error('Unexpected CTA response format (missing ctatt)');
    if (data.errCd && data.errCd !== '0') throw new Error(`CTA API error ${data.errCd}: ${data.errNm}`);

    return asArray(data.route).flatMap(route =>
        asArray(route.train).map(t => ({
            id: t.rn,
            route: route['@name'],
            lat: parseFloat(t.lat),
            lon: parseFloat(t.lon),
            heading: parseInt(t.heading, 10),
            destination: t.destNm,
            lastUpdate: t.prdt,
        })),
    );
}

function mockSnapshot(): TrainSnapshot {
    const now = Date.now();
    const generatedAt = new Date(now).toISOString();
    const trains: Train[] = [
        { id: '101', route: 'red', lat: 41.895 + Math.sin(now / 5000) * 0.01, lon: -87.625, heading: 0, destination: 'Howard', lastUpdate: generatedAt, isMock: true },
        { id: '102', route: 'red', lat: 41.86 - Math.sin(now / 5000) * 0.01, lon: -87.625, heading: 180, destination: '95th', lastUpdate: generatedAt, isMock: true },
        { id: '201', route: 'blue', lat: 41.9, lon: -87.66 + Math.cos(now / 6000) * 0.01, heading: 270, destination: "O'Hare", lastUpdate: generatedAt, isMock: true },
    ];
    return { generatedAt, trains };
}

/**
 * Polls CTA Train Tracker in the background and serves the latest snapshot
 * from memory, so client requests never hit the CTA API directly.
 * Without an API key it serves animated mock trains.
 */
export class CtaService {
    private latest: TrainSnapshot | null = null;
    private timer: NodeJS.Timeout | null = null;

    constructor(private readonly apiKey: string | undefined) {}

    start(intervalMs: number) {
        if (!this.apiKey) {
            console.warn('[cta] No CTA_TRAIN_API_KEY set — serving mock train data.');
            return;
        }
        void this.poll();
        this.timer = setInterval(() => void this.poll(), intervalMs);
        this.timer.unref();
    }

    stop() {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
    }

    getSnapshot(): TrainSnapshot {
        if (!this.apiKey) return mockSnapshot();
        return this.latest ?? { generatedAt: new Date().toISOString(), trains: [] };
    }

    private async poll() {
        try {
            const res = await axios.get<CtaRawResponse>(CTA_POSITIONS_URL, {
                params: { key: this.apiKey, rt: ROUTES.join(','), outputType: 'JSON' },
                timeout: 10_000,
            });
            this.latest = { generatedAt: new Date().toISOString(), trains: parseCtaResponse(res.data) };
        } catch (err) {
            // Keep serving the previous snapshot.
            console.error('[cta] Poll failed:', err instanceof Error ? err.message : err);
        }
    }
}
