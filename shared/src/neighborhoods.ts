import type { LatLng } from './planning';

/**
 * Starting "scenes" offered by the planner. `center` is where the night begins;
 * the planner favors nearby places from there.
 */
export const NEIGHBORHOODS = [
    { id: 'wicker-park', name: 'Wicker Park', scene: 'Trendy Zone', description: 'Hipster bars, vintage shops, and tacos.', center: { lat: 41.9104, lng: -87.6776 } },
    { id: 'river-north', name: 'River North', scene: 'High Energy', description: 'Upscale clubs, bottle service, and chaos.', center: { lat: 41.8924, lng: -87.6341 } },
    { id: 'the-loop', name: 'The Loop', scene: 'Rooftop Ridge', description: 'Views, tourists, and expensive drinks.', center: { lat: 41.882, lng: -87.6278 } },
    { id: 'logan-square', name: 'Logan Square', scene: 'Divey Strip', description: 'Cheap beer, pinball, and flannel.', center: { lat: 41.9285, lng: -87.7073 } },
    { id: 'west-loop', name: 'West Loop', scene: 'Hidden Gems', description: 'Industrial chic and michelin stars.', center: { lat: 41.8843, lng: -87.652 } },
] as const satisfies readonly { id: string; name: string; scene: string; description: string; center: LatLng }[];

export type NeighborhoodId = (typeof NEIGHBORHOODS)[number]['id'];

export const NEIGHBORHOOD_IDS = NEIGHBORHOODS.map(n => n.id) as [NeighborhoodId, ...NeighborhoodId[]];

export const getNeighborhood = (id: string) => NEIGHBORHOODS.find(n => n.id === id);
