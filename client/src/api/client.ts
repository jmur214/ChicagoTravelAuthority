import type { Location, Tag, Category } from '../../../shared';
export type { Location, Tag, Category };

const API_URL = 'http://localhost:3000/api';

// Locations
export const fetchLocations = async (includeUnverified = false): Promise<Location[]> => {
    const query = includeUnverified ? '?all=true' : '';
    const response = await fetch(`${API_URL}/locations${query}`);
    if (!response.ok) throw new Error('Failed to fetch locations');
    return response.json();
};

export type LocationPayload = Omit<Partial<Location>, 'tags' | 'categories'> & {
    tags: number[];
    categories?: number[];
};

export const createLocation = async (data: LocationPayload): Promise<Location> => {
    const response = await fetch(`${API_URL}/locations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create location');
    return response.json();
};

export const updateLocation = async (id: number, data: LocationPayload): Promise<Location> => {
    const response = await fetch(`${API_URL}/locations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update location');
    return response.json();
};

export const deleteLocation = async (id: number): Promise<void> => {
    const response = await fetch(`${API_URL}/locations/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete location');
};

// Tags
export const fetchTags = async (): Promise<Tag[]> => {
    const response = await fetch(`${API_URL}/tags`);
    if (!response.ok) throw new Error('Failed to fetch tags');
    return response.json();
};

export const createTag = async (name: string): Promise<Tag> => {
    const response = await fetch(`${API_URL}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, categoryId: 1 }) // Default category for now
    });
    if (!response.ok) throw new Error('Failed to create tag');
    return response.json();
};

export const updateTag = async (id: number, data: Partial<Tag>): Promise<Tag> => {
    const response = await fetch(`${API_URL}/tags/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update tag');
    return response.json();
};

export const deleteTag = async (id: number): Promise<void> => {
    const response = await fetch(`${API_URL}/tags/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete tag');
};

// Categories
export const fetchCategories = async (): Promise<Category[]> => {
    const response = await fetch(`${API_URL}/categories`);
    if (!response.ok) throw new Error('Failed to fetch categories');
    return response.json();
};

// Import/Plan
export const importKml = async (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_URL}/import`, {
        method: 'POST',
        body: formData
    });
    if (!response.ok) throw new Error('Import failed');
    return response.json();
};

export const generatePlan = async (criteria: any): Promise<any> => {
    const response = await fetch(`${API_URL}/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(criteria)
    });
    return response.json();
};
