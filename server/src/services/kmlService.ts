import { DOMParser } from '@xmldom/xmldom';

export interface ParsedPlace {
    name: string;
    description?: string;
    latitude: number;
    longitude: number;
    /** Folder hierarchy, e.g. ["My Places", "Bars", "Cocktails"] */
    folderPath: string[];
}

const ELEMENT_NODE = 1;

function childElements(node: Element): Element[] {
    const out: Element[] = [];
    for (let i = 0; i < node.childNodes.length; i++) {
        const child = node.childNodes[i];
        if (child.nodeType === ELEMENT_NODE) out.push(child as unknown as Element);
    }
    return out;
}

const firstChild = (node: Element, tagName: string) => childElements(node).find(c => c.tagName === tagName);

function parsePlacemark(node: Element, folderPath: string[]): ParsedPlace | null {
    const name = firstChild(node, 'name')?.textContent?.trim();
    const point = firstChild(node, 'Point');
    const coords = point && firstChild(point, 'coordinates')?.textContent?.trim();
    if (!name || !coords) return null; // only Points are supported

    // KML coordinates are "lon,lat[,alt]"
    const [lon, lat] = coords.split(',').map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    return {
        name,
        description: firstChild(node, 'description')?.textContent?.trim() || undefined,
        latitude: lat,
        longitude: lon,
        folderPath,
    };
}

function traverse(node: Element, path: string[]): ParsedPlace[] {
    if (node.tagName === 'Placemark') {
        const place = parsePlacemark(node, path);
        return place ? [place] : [];
    }

    let childPath = path;
    if (node.tagName === 'Folder' || node.tagName === 'Document') {
        const folderName = firstChild(node, 'name')?.textContent?.trim();
        if (folderName) childPath = [...path, folderName];
    }

    return childElements(node).flatMap(child => traverse(child, childPath));
}

/** Extract point placemarks (with their folder path) from a KML document. */
export function parseKml(kml: string): ParsedPlace[] {
    // xmldom returns undefined for empty input and logs (rather than throws) on malformed XML.
    const root = new DOMParser().parseFromString(kml, 'text/xml')?.documentElement;
    return root ? traverse(root as unknown as Element, []) : [];
}
