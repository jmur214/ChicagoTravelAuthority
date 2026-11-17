import {
    DEFAULT_TRANSPORT_MODE,
    scheduleStops,
    type ItineraryItem,
    type LatLng,
    type Location,
    type PlanResponse,
    type ScheduleStop,
    type TransportMode,
} from '@cta/shared';

/** The user's current night out. Persisted in localStorage. */
export interface Plan {
    items: ItineraryItem[];
    startTime: string;
    /** null = the night starts at the first stop */
    startLocation: LatLng | null;
    transportMode: TransportMode;
}

export const planFromResponse = ({ items, startTime, startLocation, transportMode }: PlanResponse): Plan => ({
    items,
    startTime,
    startLocation,
    transportMode,
});

const normalizeItem = (item: ItineraryItem): ItineraryItem => ({
    ...item,
    description: item.description ?? '',
    travelMode: item.travelMode ?? DEFAULT_TRANSPORT_MODE,
    isOpenOnArrival: item.isOpenOnArrival ?? null,
    matchScore: item.matchScore ?? 0,
});

/** Accepts plans saved by this version or older ones (which stored a bare item array). */
export function parseSavedPlan(raw: unknown): Plan | null {
    if (Array.isArray(raw)) {
        if (raw.length === 0) return null;
        const items = (raw as ItineraryItem[]).map(normalizeItem);
        const firstTravel = (items[0].travelTimeMinutes ?? 0) * 60_000;
        return {
            items,
            startTime: new Date(Date.parse(items[0].arrivalTime) - firstTravel).toISOString(),
            startLocation: null,
            transportMode: DEFAULT_TRANSPORT_MODE,
        };
    }
    if (raw && typeof raw === 'object') {
        const p = raw as Partial<Plan>;
        if (Array.isArray(p.items) && p.items.length > 0 && typeof p.startTime === 'string') {
            return {
                items: p.items.map(normalizeItem),
                startTime: p.startTime,
                startLocation: p.startLocation ?? null,
                transportMode: p.transportMode ?? DEFAULT_TRANSPORT_MODE,
            };
        }
    }
    return null;
}

const locationToStop = (loc: Location): ScheduleStop => ({
    locationId: loc.id,
    name: loc.name,
    description: loc.description,
    latitude: loc.latitude,
    longitude: loc.longitude,
    avgStayMinutes: loc.avgStayMinutes,
    openHours: loc.openHours,
});

/** Rebuild a stop from the latest location data, falling back to what the item recorded. */
function itemToStop(item: ItineraryItem, byId: Map<number, Location>): ScheduleStop {
    const loc = byId.get(item.locationId);
    const recordedStay = Math.round((Date.parse(item.departureTime) - Date.parse(item.arrivalTime)) / 60_000);
    return {
        ...(loc ? locationToStop(loc) : {
            locationId: item.locationId,
            name: item.name,
            description: item.description,
            latitude: item.coords.lat,
            longitude: item.coords.lng,
            avgStayMinutes: recordedStay,
            openHours: null,
        }),
        reason: item.reason,
        matchScore: item.matchScore,
    };
}

function retime(plan: Plan, stops: ScheduleStop[]): Plan | null {
    if (stops.length === 0) return null;
    const items = scheduleStops(stops, {
        startTime: new Date(plan.startTime),
        transportMode: plan.transportMode,
        startLocation: plan.startLocation,
    });
    return { ...plan, items };
}

const indexById = (locations: Location[]) => new Map(locations.map(l => [l.id, l]));

/** Next quarter hour, so a fresh plan starts at a sensible time. */
export function nextQuarterHour(now: Date): Date {
    const ms = 15 * 60_000;
    return new Date(Math.ceil(now.getTime() / ms) * ms);
}

export function addStop(plan: Plan | null, loc: Location, locations: Location[], now = new Date()): Plan {
    const base: Plan = plan ?? {
        items: [],
        startTime: nextQuarterHour(now).toISOString(),
        startLocation: null,
        transportMode: DEFAULT_TRANSPORT_MODE,
    };
    if (base.items.some(i => i.locationId === loc.id)) return base;
    const byId = indexById(locations);
    return retime(base, [...base.items.map(i => itemToStop(i, byId)), locationToStop(loc)])!;
}

/** Returns null when the last stop is removed. */
export function removeStop(plan: Plan, locationId: number, locations: Location[]): Plan | null {
    const byId = indexById(locations);
    return retime(plan, plan.items.filter(i => i.locationId !== locationId).map(i => itemToStop(i, byId)));
}

export function moveStop(plan: Plan, index: number, delta: -1 | 1, locations: Location[]): Plan {
    const target = index + delta;
    if (target < 0 || target >= plan.items.length) return plan;
    const items = [...plan.items];
    [items[index], items[target]] = [items[target], items[index]];
    const byId = indexById(locations);
    return retime(plan, items.map(i => itemToStop(i, byId)))!;
}

export function changeTransportMode(plan: Plan, mode: TransportMode, locations: Location[]): Plan {
    const byId = indexById(locations);
    return retime({ ...plan, transportMode: mode }, plan.items.map(i => itemToStop(i, byId)))!;
}
