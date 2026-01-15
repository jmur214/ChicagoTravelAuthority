export interface Category {
    id: number;
    name: string;
    parentId?: number | null;
    children?: Category[];
    color?: string | null;
    shape?: string | null;
}

export interface Tag {
    id: number;
    name: string;
    categories?: Category[];
}

export interface LocationTag {
    tag: Tag;
}

export interface Location {
    id: number;
    name: string;
    description?: string;
    latitude: number;
    longitude: number;
    address?: string;
    googlePlaceId?: string;
    metadata?: any;
    avgCost?: number | null; // 1-4
    avgStayMinutes?: number;
    openHours?: any; // JSON
    website?: string | null;
    menuUrl?: string | null;
    eventsInfo?: string | null;
    rating?: number | null;
    reviewCount?: number | null;
    tags?: LocationTag[];

    // Phase 20-23 Fields
    isConfirmed: boolean;
    verifiedVibe: boolean;
    userVerifiedCount: number;
    categories?: Category[];
}
