
interface TagMapping {
    name: string;
    category: 'Primary' | 'Neighborhood' | 'Purpose' | 'Vibe' | 'Other';
}

const KNOWN_MAPPINGS: Record<string, TagMapping> = {
    'bars': { name: 'Bar', category: 'Primary' },
    'bar': { name: 'Bar', category: 'Primary' },
    'restaurants': { name: 'Restaurant', category: 'Primary' },
    'restaurant': { name: 'Restaurant', category: 'Primary' },
    'food': { name: 'Restaurant', category: 'Primary' },
    'coffee': { name: 'Coffee Shop', category: 'Primary' },
    'cafes': { name: 'Coffee Shop', category: 'Primary' },
    'shops': { name: 'Shop', category: 'Primary' },
    'shopping': { name: 'Shop', category: 'Primary' },

    // Neighborhoods
    'river north': { name: 'River North', category: 'Neighborhood' },
    'wicker park': { name: 'Wicker Park', category: 'Neighborhood' },
    'logan square': { name: 'Logan Square', category: 'Neighborhood' },
    'west loop': { name: 'West Loop', category: 'Neighborhood' },
    'lincoln park': { name: 'Lincoln Park', category: 'Neighborhood' },
    'pilsen': { name: 'Pilsen', category: 'Neighborhood' },

    // Attributes
    'cocktails': { name: 'Cocktails', category: 'Purpose' },
    'good cocktails': { name: 'Cocktails', category: 'Purpose' },
    'touristy': { name: 'Touristy', category: 'Vibe' },
    'hidden gems': { name: 'Hidden Gem', category: 'Vibe' }
};

export class TagService {
    analyzeFolderPaths(folderPaths: string[]): { primary?: string, secondary: string[], neighborhood?: string, unverified: string[] } {
        let primary: string | undefined;
        let neighborhood: string | undefined;
        const secondary: string[] = [];
        const unverified: string[] = [];

        // Flatten and clean
        const allFolders = folderPaths.map(f => f.toLowerCase().trim()).filter(f => f && f !== 'my places');

        for (const folder of allFolders) {
            const mapped = this.findMapping(folder);
            if (mapped) {
                if (mapped.category === 'Primary') {
                    if (!primary) primary = mapped.name;
                    // If multiple primaries, maybe treat others as secondary or ignore? 
                    // For now, first wins or specific logic.
                } else if (mapped.category === 'Neighborhood') {
                    neighborhood = mapped.name;
                } else {
                    secondary.push(mapped.name);
                }
            } else {
                unverified.push(folder);
            }
        }

        return { primary, secondary, neighborhood, unverified };
    }

    private findMapping(folder: string): TagMapping | undefined {
        // Direct match
        if (KNOWN_MAPPINGS[folder]) return KNOWN_MAPPINGS[folder];

        // Partial match logic could go here (e.g. "Best Bars" -> "Bar")
        if (folder.includes('bar')) return KNOWN_MAPPINGS['bars'];
        if (folder.includes('restaurant')) return KNOWN_MAPPINGS['restaurants'];
        if (folder.includes('coffee')) return KNOWN_MAPPINGS['coffee'];

        return undefined;
    }
}
