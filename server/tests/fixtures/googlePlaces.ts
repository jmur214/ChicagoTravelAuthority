import type { GPlace } from '../../src/services/places/google';

/**
 * Hand-written Places API (New) responses, shaped per the API's discovery
 * document (GoogleMapsPlacesV1Place). Not captured from the live API.
 * Google days: 0 = Sunday.
 */

const p = (day: number, hour: number, minute = 0) => ({ day, hour, minute });

/** A bar open 5pm–2am Mon–Thu, 4pm–3am Fri/Sat, closed Sunday. */
export const VIOLET_HOUR: GPlace = {
    id: 'ChIJviolethour',
    displayName: { text: 'The Violet Hour' },
    formattedAddress: '1520 N Damen Ave, Chicago, IL 60622, USA',
    location: { latitude: 41.90865, longitude: -87.67765 },
    regularOpeningHours: {
        periods: [
            { open: p(1, 17), close: p(2, 2) },
            { open: p(2, 17), close: p(3, 2) },
            { open: p(3, 17), close: p(4, 2) },
            { open: p(4, 17), close: p(5, 2) },
            { open: p(5, 16), close: p(6, 3) },
            { open: p(6, 16), close: p(0, 3) }, // Saturday night into Sunday
        ],
    },
    nationalPhoneNumber: '(773) 252-1500',
    websiteUri: 'https://www.theviolethour.com/',
    rating: 4.6,
    userRatingCount: 2140,
    priceLevel: 'PRICE_LEVEL_EXPENSIVE',
    businessStatus: 'OPERATIONAL',
    googleMapsUri: 'https://maps.google.com/?cid=111',
    types: ['bar', 'point_of_interest', 'establishment'],
    editorialSummary: { text: 'Upscale cocktail lounge with a hidden entrance.' },
};

/** Lunch and dinner service every day but Monday. */
export const SPLIT_SHIFT_DINER: GPlace = {
    id: 'ChIJdiner',
    displayName: { text: "Lou Malnati's Pizzeria" },
    location: { latitude: 41.8904, longitude: -87.6337 },
    regularOpeningHours: {
        periods: [0, 2, 3, 4, 5, 6].flatMap(day => [
            { open: p(day, 11), close: p(day, 14, 30) },
            { open: p(day, 17), close: p(day, 22) },
        ]),
    },
    priceLevel: 'PRICE_LEVEL_MODERATE',
    businessStatus: 'OPERATIONAL',
};

/** 24/7: one period, no close. */
export const ALWAYS_OPEN: GPlace = {
    id: 'ChIJ247',
    displayName: { text: 'Diner 24' },
    location: { latitude: 41.9, longitude: -87.65 },
    regularOpeningHours: { periods: [{ open: p(0, 0) }] },
};

/** Closed for renovations: empty periods. */
export const TEMPORARILY_CLOSED: GPlace = {
    id: 'ChIJreno',
    displayName: { text: 'Old Town Ale House' },
    location: { latitude: 41.9112, longitude: -87.6343 },
    regularOpeningHours: { periods: [] },
    businessStatus: 'CLOSED_TEMPORARILY',
};

export const PERMANENTLY_CLOSED: GPlace = {
    id: 'ChIJgone',
    displayName: { text: 'The Gone Bar' },
    location: { latitude: 41.9, longitude: -87.66 },
    businessStatus: 'CLOSED_PERMANENTLY',
};

/** Minimal listing with no hours at all. */
export const NO_HOURS: GPlace = {
    id: 'ChIJnohours',
    displayName: { text: 'Mystery Spot' },
    location: { latitude: 41.88, longitude: -87.63 },
};
