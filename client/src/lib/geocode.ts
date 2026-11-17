export interface GeocodeResult {
    name: string;
    latitude: number;
    longitude: number;
    address: string;
}

interface NominatimResult {
    name?: string;
    display_name: string;
    lat: string;
    lon: string;
}

/** Look up a place by free text via OpenStreetMap Nominatim (biased to Chicago). */
export async function geocodePlace(query: string): Promise<GeocodeResult | null> {
    const params = new URLSearchParams({ format: 'json', limit: '1', q: query, viewbox: '-88.0,42.1,-87.5,41.6' });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
    if (!res.ok) throw new Error(`Place search failed (${res.status})`);
    const [first] = (await res.json()) as NominatimResult[];
    if (!first) return null;
    return {
        name: first.name || first.display_name.split(',')[0],
        latitude: Number(first.lat),
        longitude: Number(first.lon),
        address: first.display_name,
    };
}
