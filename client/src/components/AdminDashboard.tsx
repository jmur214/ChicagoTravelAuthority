import React, { useState, useEffect } from 'react';
import type { Location, Category } from '../../../shared';
import { fetchLocations, deleteLocation, updateLocation } from '../api/client';

import LocationModal from './LocationModal';
import TagManager from './TagManager';
import CategoryManager from './CategoryManager';

const AdminDashboard: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [locations, setLocations] = useState<Location[]>([]);
    const [allCategories, setAllCategories] = useState<Category[]>([]);
    const [search, setSearch] = useState('');
    // const [loading, setLoading] = useState(true); // Unused
    const [editingLocation, setEditingLocation] = useState<Location | null | undefined>(undefined);
    const [showTags, setShowTags] = useState(false);
    const [showCategories, setShowCategories] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const [locs, cats] = await Promise.all([
            fetchLocations(true),
            fetch('http://localhost:3000/api/categories').then(r => r.json())
        ]);
        setLocations(locs);
        setAllCategories(cats);
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this location?')) return;
        await deleteLocation(id);
        setLocations(locations.filter(l => l.id !== id));
    };

    const handleSave = () => {
        loadData();
        setEditingLocation(undefined);
    };

    const [sortField, setSortField] = useState<'name' | 'id' | 'description'>('name');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [showUnverifiedOnly, setShowUnverifiedOnly] = useState(false);

    const handleSort = (field: 'name' | 'id' | 'description') => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const handleVerify = async (id: number) => {
        // Need to import updateLocation or implement inline
        // Assuming updateLocation is available via import { updateLocation }...
        // Let's verify import
        const res = await fetch(`http://localhost:3000/api/locations/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isConfirmed: true })
        });
        if (res.ok) {
            // Optimistic update
            setLocations(prev => prev.map(l => l.id === id ? { ...l, isConfirmed: true } as any : l));
        }
    };

    const handleVerifyVibe = async (id: number, status: boolean) => {
        const res = await fetch(`http://localhost:3000/api/locations/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ verifiedVibe: status })
        });
        if (res.ok) {
            setLocations(prev => prev.map(l => l.id === id ? { ...l, verifiedVibe: status } as any : l));
        }
    };
    const handleApplyCategory = async (locationId: number, currentCategories: Category[] = [], newCategoryId: number) => {
        // Prevent duplicates
        if (currentCategories.some(c => c.id === newCategoryId)) return;

        const newCategoryIds = [...currentCategories.map(c => c.id), newCategoryId];

        const res = await updateLocation(locationId, {
            tags: locations.find(l => l.id === locationId)?.tags?.map(t => t.tag.id) || [], // Keep tags (required by strict typing)
            categories: newCategoryIds
        } as any);

        if (res) {
            setLocations(prev => prev.map(l => l.id === locationId ? { ...l, categories: [...currentCategories, { id: newCategoryId, name: '_' }] } as any : l)); // Optimistic, will reload anyway
            loadData();
        }
    };

    const handleApplyAllSuggestions = async (locationId: number, currentCategories: Category[] = [], newCategories: Category[]) => {
        const newCategoryIds = [...currentCategories.map(c => c.id), ...newCategories.map(c => c.id)];
        // Unique
        const uniqueIds = Array.from(new Set(newCategoryIds));

        const res = await updateLocation(locationId, {
            tags: locations.find(l => l.id === locationId)?.tags?.map(t => t.tag.id) || [],
            categories: uniqueIds
        } as any);

        loadData();
    };

    const filtered = locations
        .filter(l => {
            const matchesSearch = l.name.toLowerCase().includes(search.toLowerCase()) ||
                l.tags?.some((t: any) => t.tag.name.toLowerCase().includes(search.toLowerCase()));

            if (showUnverifiedOnly) {
                return matchesSearch && !(l as any).isConfirmed;
            }
            return matchesSearch;
        })
        .sort((a, b) => {
            const mod = sortDirection === 'asc' ? 1 : -1;
            if (sortField === 'name') return a.name.localeCompare(b.name) * mod;
            if (sortField === 'description') return (a.description || '').localeCompare(b.description || '') * mod;
            return (a.id - b.id) * mod;
        });

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[10000] flex justify-center items-center p-8">
            <div className="glass-panel w-full max-w-6xl h-full max-h-[90vh] rounded-2xl flex flex-col overflow-hidden bg-[#121212]">

                {/* Header */}
                <div className="p-6 border-b border-white/10 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-white">Data Management</h2>
                        <div className="flex gap-4 text-sm mt-1 items-center">
                            <p className="text-gray-400">Locations ({locations.length})</p>
                            <span className="w-px h-4 bg-white/10"></span>
                            <button
                                onClick={() => setShowUnverifiedOnly(!showUnverifiedOnly)}
                                className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold transition ${showUnverifiedOnly ? 'bg-yellow-500 text-black' : 'bg-white/5 text-gray-400'}`}
                            >
                                {locations.filter(l => !(l as any).isConfirmed).length} Pending Review
                            </button>
                            <span className="w-px h-4 bg-white/10"></span>
                            <button onClick={() => setShowTags(true)} className="text-gray-400 hover:text-white transition">
                                Manage Tags
                            </button>
                            <button onClick={() => setShowCategories(true)} className="text-brand-accent hover:text-white transition font-bold">
                                Manage Categories
                            </button>
                        </div>
                    </div>
                    <button onClick={onClose} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition">
                        Close Dashboard
                    </button>
                </div>

                {/* Toolbar */}
                <div className="p-4 bg-white/5 border-b border-white/10 flex gap-4">
                    <input
                        type="text"
                        placeholder="Search locations..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-brand-primary w-96"
                    />
                    <button
                        onClick={() => setEditingLocation(null)}
                        className="px-4 py-2 bg-brand-primary text-white rounded-lg font-medium shadow-lg hover:bg-brand-primary/80 transition"
                    >
                        + Add New Location
                    </button>
                    <div className="ml-auto text-sm text-gray-400 self-center">
                        {filtered.length} locations found
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-white/5 sticky top-0 z-10 text-xs uppercase text-gray-400">
                            <tr>
                                <th className="p-4 font-semibold cursor-pointer hover:text-white transition" onClick={() => handleSort('name')}>
                                    Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="p-4 font-semibold cursor-pointer hover:text-white transition" onClick={() => handleSort('description')}>
                                    Description {sortField === 'description' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="p-4 font-semibold">Status</th>
                                <th className="p-4 font-semibold">Price</th>
                                <th className="p-4 font-semibold">Stay</th>
                                <th className="p-4 font-semibold">Tags</th>
                                <th className="p-4 font-semibold">Category(s)</th>
                                <th className="p-4 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filtered.map(loc => (
                                <tr key={loc.id} className={`hover:bg-white/5 transition group ${(loc as any).isConfirmed ? '' : 'bg-yellow-900/10'}`}>
                                    <td className="p-4 font-medium text-white flex items-center gap-2">
                                        {!(loc as any).isConfirmed && <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" title="Needs Verification"></span>}
                                        {loc.name}
                                    </td>
                                    <td className="p-4 text-gray-400 max-w-xs truncate">{loc.description}</td>
                                    <td className="p-4 text-xs font-mono">
                                        <div className="flex flex-col gap-2">
                                            {(loc as any).isConfirmed ? (
                                                <span className="text-green-500 flex items-center gap-1">✓ Confirmed</span>
                                            ) : (
                                                <button onClick={() => handleVerify(loc.id)} className="text-yellow-500 hover:text-yellow-400 underline decoration-dotted text-left">
                                                    Approve Data
                                                </button>
                                            )}

                                            {(loc as any).verifiedVibe ? (
                                                <button onClick={() => handleVerifyVibe(loc.id, false)} className="text-brand-accent hover:text-white flex items-center gap-1">
                                                    ★ Verified Vibe
                                                </button>
                                            ) : (
                                                <button onClick={() => handleVerifyVibe(loc.id, true)} className="text-gray-600 hover:text-brand-accent text-left">
                                                    ☆ Mark Vibe
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4 text-gray-400 text-xs">
                                        {[...Array(loc.avgCost || 1)].map(() => '$').join('')}
                                    </td>
                                    <td className="p-4 text-gray-400 text-xs text-nowrap">
                                        {loc.avgStayMinutes || 90}m
                                    </td>
                                    <td className="p-4">
                                        {/* Tag Chips */}
                                        <div className="flex flex-wrap gap-1">
                                            {loc.tags?.map((t: any) => (
                                                <span key={t.tag.id} className="px-2 py-0.5 rounded text-xs bg-white/10 text-gray-400 border border-white/10">
                                                    {t.tag.name}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col gap-2 min-w-[200px]">
                                            {/* Category Chips with Remove */}
                                            <div className="flex flex-wrap gap-1">
                                                {(loc as any).categories?.map((c: any) => (
                                                    <span key={c.id} className="px-2 py-0.5 rounded text-xs bg-brand-accent/20 text-brand-accent border border-brand-accent/30 font-bold">
                                                        {c.name}
                                                    </span>
                                                ))}
                                            </div>

                                            {/* Guided Suggestions */}
                                            {(() => {
                                                const currentCatIds = new Set((loc as any).categories?.map((c: any) => c.id) || []);
                                                const suggestions = new Map<number, Category>();

                                                loc.tags?.forEach((t: any) => {
                                                    t.tag.categories?.forEach((c: Category) => {
                                                        if (c.name !== 'Folder' && !currentCatIds.has(c.id)) {
                                                            suggestions.set(c.id, c);
                                                        }
                                                    });
                                                });

                                                const suggestionList = Array.from(suggestions.values());

                                                if (suggestionList.length > 0) {
                                                    return (
                                                        <div className="flex flex-wrap gap-1 items-center animate-in fade-in slide-in-from-left-1 duration-500">
                                                            <span className="text-[10px] text-brand-primary uppercase font-bold mr-1">✨ Suggested:</span>
                                                            {suggestionList.map(s => (
                                                                <button
                                                                    key={s.id}
                                                                    onClick={() => handleApplyCategory(loc.id, (loc as any).categories, s.id)}
                                                                    className="px-2 py-0.5 rounded text-[10px] border border-dashed border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white transition"
                                                                    title="Click to add this category"
                                                                >
                                                                    + {s.name}
                                                                </button>
                                                            ))}
                                                            {suggestionList.length > 1 && (
                                                                <button
                                                                    onClick={() => handleApplyAllSuggestions(loc.id, (loc as any).categories, suggestionList)}
                                                                    className="ml-1 px-2 py-0.5 rounded text-[10px] bg-brand-primary text-white font-bold hover:bg-white hover:text-black transition"
                                                                >
                                                                    Add All
                                                                </button>
                                                            )}
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            })()}

                                            {/* Manual Add Dropdown */}
                                            <select
                                                className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-gray-400 outline-none hover:bg-white/10 transition mt-1 w-full max-w-[150px]"
                                                onChange={(e) => handleApplyCategory(loc.id, (loc as any).categories, Number(e.target.value))}
                                                value=""
                                            >
                                                <option value="" disabled>+ Add Category</option>
                                                {allCategories.filter(cat => !((loc as any).categories?.some((c: any) => c.id === cat.id)) && cat.name !== 'Folder').map(cat => (
                                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </td>
                                    {/* Merged Tags/Cats into one column? Or keep separate? 
                                        User asked for easier way.
                                        I'll keep 'Tags' column but rename to 'Categorization' and show both.
                                    */}
                                    <td className="p-4 text-right opacity-0 group-hover:opacity-100 transition">
                                        <button onClick={() => setEditingLocation(loc)} className="text-brand-accent hover:text-white mr-3 text-sm">Edit</button>
                                        <button onClick={() => handleDelete(loc.id)} className="text-red-500 hover:text-red-400 text-sm">Delete</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

            </div>

            {editingLocation !== undefined && (
                <LocationModal
                    location={editingLocation}
                    onClose={() => setEditingLocation(undefined)}
                    onSave={handleSave}
                />
            )}
            {showTags && <TagManager onClose={() => setShowTags(false)} />}
            {showCategories && <CategoryManager onClose={() => setShowCategories(false)} />}
        </div>
    );
};

export default AdminDashboard;
