import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

interface ShapePoint {
    shape_id: string;
    shape_pt_lat: number;
    shape_pt_lon: number;
    shape_pt_sequence: number;
}

interface Route {
    route_id: string;
    route_short_name: string;
    route_long_name: string;
    route_type: string; // 1 = Subway/Metro
    route_color: string;
}

interface Trip {
    route_id: string;
    service_id: string;
    trip_id: string;
    shape_id: string;
}

interface ProcessedRoute {
    id: string;
    name: string;
    color: string;
    shapes: number[][][]; // Array of polylines (lat/lon arrays)
}

export class GtfsService {
    // Path relative to server execution (project root/google_transit)
    // Assuming server runs from /server directory, and folder is at /google_transit (sibling to server)
    // or /server/google_transit.
    // Based on user input "moved the file into the folder... folder is google_transit", let's try strict path resolution.
    private readonly GTFS_DIR = path.resolve(__dirname, '../../../google_transit');
    private processedRoutes: ProcessedRoute[] = [];
    private isReady: boolean = false;

    public async initialize() {
        console.log(`[GtfsService] Starting GTFS initialization from ${this.GTFS_DIR}...`);
        try {
            // Check dir existence
            try {
                await fs.promises.access(this.GTFS_DIR);
            } catch {
                throw new Error(`GTFS directory not found at ${this.GTFS_DIR}`);
            }

            // 2. Parse routes.txt
            const routesPath = path.join(this.GTFS_DIR, 'routes.txt');
            const routesCsv = await fs.promises.readFile(routesPath, 'utf8');
            const routes = parse(routesCsv, { columns: true, skip_empty_lines: true }) as Route[];

            // Filter for 'L' trains (route_type === '1')
            const trainRoutes = routes.filter(r => r.route_type === '1');
            const trainRouteIds = new Set(trainRoutes.map(r => r.route_id));

            // 3. Parse trips.txt to link Routes -> Shapes
            const tripsPath = path.join(this.GTFS_DIR, 'trips.txt');
            const tripsCsv = await fs.promises.readFile(tripsPath, 'utf8');
            const trips = parse(tripsCsv, { columns: true, skip_empty_lines: true }) as Trip[];

            // Map RouteID -> Set of ShapeIDs
            const routeToShapes = new Map<string, Set<string>>();
            trips.forEach(t => {
                if (trainRouteIds.has(t.route_id)) {
                    if (!routeToShapes.has(t.route_id)) routeToShapes.set(t.route_id, new Set());
                    routeToShapes.get(t.route_id)?.add(t.shape_id);
                }
            });

            // 4. Parse shapes.txt
            const shapesPath = path.join(this.GTFS_DIR, 'shapes.txt');
            console.log('[GtfsService] Parsing shapes...');
            const shapesCsv = await fs.promises.readFile(shapesPath, 'utf8');
            const shapePoints = parse(shapesCsv, { columns: true, skip_empty_lines: true }) as ShapePoint[];

            // Group points by shape_id
            const shapeMap = new Map<string, ShapePoint[]>();
            shapePoints.forEach(p => {
                const id = p.shape_id;
                if (!shapeMap.has(id)) shapeMap.set(id, []);
                shapeMap.get(id)?.push(p);
            });

            // 5. Assemble Final Data
            this.processedRoutes = trainRoutes.map(route => {
                const shapeIds = routeToShapes.get(route.route_id) || new Set();
                const routeShapes: number[][][] = [];

                // For each unique shape associated with this route layout
                shapeIds.forEach(shapeId => {
                    const points = shapeMap.get(shapeId) || [];
                    points.sort((a, b) => Number(a.shape_pt_sequence) - Number(b.shape_pt_sequence));

                    // Convert to [lat, lon] array
                    const polyline = points.map(p => [Number(p.shape_pt_lat), Number(p.shape_pt_lon)]);
                    if (polyline.length > 0) {
                        routeShapes.push(polyline);
                    }
                });

                return {
                    id: route.route_id,
                    name: route.route_long_name,
                    color: `#${route.route_color}`,
                    shapes: routeShapes
                };
            });

            this.isReady = true;
            console.log(`[GtfsService] Ready. Processed ${this.processedRoutes.length} train routes.`);

        } catch (error) {
            console.error('[GtfsService] Initialization failed:', error);
        }
    }

    public getRoutes() {
        return this.processedRoutes;
    }
}

export const gtfsService = new GtfsService();
