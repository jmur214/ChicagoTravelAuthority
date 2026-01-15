import { DOMParser } from '@xmldom/xmldom';

export interface ParsedPlace {
    name: string;
    description?: string;
    latitude: number;
    longitude: number;
    folderPath: string[]; // Hierarchy: ["My Places", "Bars", "Chicago"]
}

export class KmlService {
    parseKml(kmlContent: string): ParsedPlace[] {
        const parser = new DOMParser();
        const doc = parser.parseFromString(kmlContent, 'text/xml');
        // Traverse starting from root
        return this.traverseNode(doc.documentElement, []);
    }

    private traverseNode(node: Element, currentPath: string[]): ParsedPlace[] {
        const results: ParsedPlace[] = [];
        const tagName = node.tagName;

        let newPath = currentPath;

        if (tagName === 'Folder' || tagName === 'Document') {
            const nameNode = this.getChildByTagName(node, 'name');
            const folderName = nameNode?.textContent || '';
            if (folderName) {
                newPath = [...currentPath, folderName];
            }
        }

        if (tagName === 'Placemark') {
            const place = this.parsePlacemark(node, currentPath);
            if (place) return [place];
            return [];
        }

        // Recurse children
        if (node.hasChildNodes()) {
            for (let i = 0; i < node.childNodes.length; i++) {
                const child = node.childNodes[i];
                if (child.nodeType === 1) { // Element node
                    results.push(...this.traverseNode(child as Element, newPath));
                }
            }
        }

        return results;
    }

    private parsePlacemark(node: Element, folderPath: string[]): ParsedPlace | null {
        const nameNode = this.getChildByTagName(node, 'name');
        const descNode = this.getChildByTagName(node, 'description');
        const pointNode = this.getChildByTagName(node, 'Point');

        if (!pointNode) return null; // Only parsing Points for now

        const coordsNode = this.getChildByTagName(pointNode, 'coordinates');
        const coordsText = coordsNode?.textContent?.trim();

        if (!nameNode || !coordsText) return null;

        const parts = coordsText.split(',');
        if (parts.length < 2) return null;

        const lon = parseFloat(parts[0]);
        const lat = parseFloat(parts[1]);

        return {
            name: nameNode.textContent || 'Unknown',
            description: descNode?.textContent || undefined,
            latitude: lat,
            longitude: lon,
            folderPath
        };
    }

    private getChildByTagName(node: Element, tagName: string): Element | undefined {
        for (let i = 0; i < node.childNodes.length; i++) {
            const child = node.childNodes[i];
            if (child.nodeType === 1 && (child as Element).tagName === tagName) {
                return child as Element;
            }
        }
        return undefined;
    }
}
