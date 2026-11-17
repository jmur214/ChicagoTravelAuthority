import type { Location, MarkerShape } from '@cta/shared';

export interface MarkerConfig {
    color: string;
    shape: MarkerShape;
    pulseClass: string;
    /** px */
    size: number;
}

/** Fallback styling by tag name for locations without a category. First match wins. */
const TAG_STYLES: { tags: string[]; config: MarkerConfig }[] = [
    { tags: ['Nightclub', 'Dance', 'High Energy'], config: { color: '#00F0FF', shape: 'star', pulseClass: 'animate-pulse-fast', size: 32 } },
    { tags: ['Bar', 'Pub', 'Dive Bar', 'Chill'], config: { color: '#FFBF00', shape: 'circle', pulseClass: 'animate-pulse-slow', size: 24 } },
    { tags: ['Rooftop', 'View'], config: { color: '#3BFFFF', shape: 'ring', pulseClass: '', size: 28 } },
    { tags: ['Restaurant', 'Food', 'Trendy'], config: { color: '#FF0099', shape: 'circle', pulseClass: 'animate-pulse-slow', size: 20 } },
    { tags: ['Hidden Gem', 'Speakeasy'], config: { color: '#7A00FF', shape: 'diamond', pulseClass: 'animate-pulse-slow', size: 24 } },
];

const DEFAULT_MARKER: MarkerConfig = { color: '#ffffff', shape: 'circle', pulseClass: '', size: 16 };

/** The first category's color/shape wins; otherwise fall back to tag-based styling. */
export function getMarkerConfig(loc: Location): MarkerConfig {
    const category = loc.categories[0];
    if (category) {
        return { color: category.color || '#ffffff', shape: category.shape || 'circle', pulseClass: '', size: 24 };
    }
    const tagNames = loc.tags.map(t => t.tag.name);
    return TAG_STYLES.find(s => s.tags.some(t => tagNames.includes(t)))?.config ?? DEFAULT_MARKER;
}

const STAR_CLIP = 'clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);';

/** Inline-styled HTML for a Leaflet divIcon. */
export function markerHtml({ color, shape, pulseClass, size }: MarkerConfig): string {
    const isRing = shape === 'ring';
    const rotate = shape === 'diamond' ? 'transform: rotate(45deg);' : '';
    const round = shape === 'circle' || isRing ? 'border-radius: 50%;' : '';
    const body = [
        `background-color: ${isRing ? 'transparent' : color};`,
        `border: ${isRing ? `3px solid ${color}` : '1px solid rgba(255,255,255,0.8)'};`,
        `box-shadow: 0 0 10px ${color};`,
        'width: 100%; height: 100%;',
        rotate,
        shape === 'star' ? STAR_CLIP : '',
        round,
    ].join(' ');

    const pulse = pulseClass
        ? `<div class="${pulseClass}" style="position:absolute; inset:0; background-color:${color}; opacity:0.5; border-radius:50%; ${rotate}"></div>`
        : '';

    return `<div style="width:${size}px; height:${size}px; position:relative;">${pulse}<div style="${body}"></div></div>`;
}
