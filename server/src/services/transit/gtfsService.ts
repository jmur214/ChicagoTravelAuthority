import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import type { TransitRoute } from '@cta/shared';

/** GTFS route_type for subway/metro ("L" trains). */
const ROUTE_TYPE_METRO = '1';

interface GtfsRoute { route_id: string; route_long_name: string; route_type: string; route_color: string }
interface GtfsTrip { route_id: string; shape_id: string }
interface GtfsShapePoint { shape_id: string; shape_pt_lat: string; shape_pt_lon: string; shape_pt_sequence: string }

const readCsv = async <T>(dir: string, file: string): Promise<T[]> =>
    parse(await fs.promises.readFile(path.join(dir, file), 'utf8'), { columns: true, skip_empty_lines: true }) as T[];

/** Builds "L" line polylines from a static CTA GTFS feed. */
export async function loadTrainRoutes(gtfsDir: string): Promise<TransitRoute[]> {
    const [routes, trips, points] = await Promise.all([
        readCsv<GtfsRoute>(gtfsDir, 'routes.txt'),
        readCsv<GtfsTrip>(gtfsDir, 'trips.txt'),
        readCsv<GtfsShapePoint>(gtfsDir, 'shapes.txt'),
    ]);

    const trainRoutes = routes.filter(r => r.route_type === ROUTE_TYPE_METRO);
    const trainRouteIds = new Set(trainRoutes.map(r => r.route_id));

    const shapesByRoute = new Map<string, Set<string>>();
    for (const t of trips) {
        if (!trainRouteIds.has(t.route_id)) continue;
        if (!shapesByRoute.has(t.route_id)) shapesByRoute.set(t.route_id, new Set());
        shapesByRoute.get(t.route_id)!.add(t.shape_id);
    }

    const pointsByShape = new Map<string, GtfsShapePoint[]>();
    for (const p of points) {
        if (!pointsByShape.has(p.shape_id)) pointsByShape.set(p.shape_id, []);
        pointsByShape.get(p.shape_id)!.push(p);
    }

    return trainRoutes.map(route => ({
        id: route.route_id,
        name: route.route_long_name,
        color: `#${route.route_color}`,
        shapes: [...(shapesByRoute.get(route.route_id) ?? [])]
            .map(shapeId =>
                (pointsByShape.get(shapeId) ?? [])
                    .sort((a, b) => Number(a.shape_pt_sequence) - Number(b.shape_pt_sequence))
                    .map(p => [Number(p.shape_pt_lat), Number(p.shape_pt_lon)] as [number, number]),
            )
            .filter(line => line.length > 0),
    }));
}

export class GtfsService {
    private routes: TransitRoute[] = [];

    constructor(private readonly gtfsDir: string) {}

    async initialize() {
        if (!fs.existsSync(this.gtfsDir)) {
            console.warn(`[gtfs] No GTFS feed at ${this.gtfsDir} — train lines disabled. Set GTFS_DIR to enable.`);
            return;
        }
        try {
            this.routes = await loadTrainRoutes(this.gtfsDir);
            console.log(`[gtfs] Loaded ${this.routes.length} train routes.`);
        } catch (err) {
            console.error('[gtfs] Failed to load feed:', err);
        }
    }

    getRoutes(): TransitRoute[] {
        return this.routes;
    }
}
