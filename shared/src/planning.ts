import { distanceKm } from './geo';
import { getOpenStatus, type OpenHours } from './openHours';
import type { ItineraryItem } from './models';
import type { TransportMode } from './schemas';

export const DEFAULT_TRANSPORT_MODE: TransportMode = 'drive';

/** Rough average door-to-door speeds in the city, km/h. */
export const SPEED_KMH: Record<TransportMode, number> = { walk: 5, drive: 30, transit: 15 };

/** The planner won't suggest a walk longer than this between stops. */
export const MAX_WALK_KM = 1.5;

export const DEFAULT_STAY_MINUTES = 90;

export interface LatLng {
    lat: number;
    lng: number;
}

export function travelMinutes(from: LatLng, to: LatLng, mode: TransportMode): number {
    return (distanceKm(from.lat, from.lng, to.lat, to.lng) / SPEED_KMH[mode]) * 60;
}

/** true/false when hours are known, null when they aren't. */
export function isOpenAt(hours: OpenHours | null | undefined, at: Date): boolean | null {
    const { state } = getOpenStatus(hours, at);
    return state === 'unknown' ? null : state === 'open';
}

export interface ScheduleStop {
    locationId: number;
    name: string;
    description: string | null;
    latitude: number;
    longitude: number;
    avgStayMinutes: number | null;
    openHours: OpenHours | null;
    /** Kept from the planner when re-timing; defaults for hand-added stops. */
    reason?: string;
    matchScore?: number;
}

export interface ScheduleOptions {
    startTime: Date;
    transportMode: TransportMode;
    /** Where the night starts; null = at the first stop. */
    startLocation: LatLng | null;
}

/**
 * Assign arrival/departure times to stops in the given order: travel from the
 * previous stop, then stay for the place's average visit length.
 */
export function scheduleStops(stops: ScheduleStop[], { startTime, transportMode, startLocation }: ScheduleOptions): ItineraryItem[] {
    let here: LatLng | null = startLocation;
    let now = startTime.getTime();

    return stops.map((stop, i) => {
        const coords = { lat: stop.latitude, lng: stop.longitude };
        const travel = here ? travelMinutes(here, coords, transportMode) : 0;
        const arrival = now + travel * 60_000;
        const departure = arrival + (stop.avgStayMinutes || DEFAULT_STAY_MINUTES) * 60_000;

        here = coords;
        now = departure;

        return {
            order: i + 1,
            locationId: stop.locationId,
            name: stop.name,
            description: stop.description ?? '',
            coords,
            arrivalTime: new Date(arrival).toISOString(),
            departureTime: new Date(departure).toISOString(),
            reason: stop.reason ?? 'Added by you',
            travelTimeMinutes: Math.round(travel),
            travelMode: transportMode,
            matchScore: stop.matchScore ?? 0,
            isOpenOnArrival: isOpenAt(stop.openHours, new Date(arrival)),
        };
    });
}
