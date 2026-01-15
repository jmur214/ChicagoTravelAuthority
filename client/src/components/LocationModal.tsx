
import React, { useState, useEffect } from 'react';
import type { Location, Tag, Category } from '../../../shared';
import { createLocation, updateLocation, fetchTags } from '../api/client';

interface LocationModalProps {
    location?: Location | null;
    onClose: () => void;
    onSave: () => void;
}

const LocationModal: React.FC<LocationModalProps> = ({ location, onClose, onSave }) => {
    const [name, setName] = useState(location?.name || '');
    const [description, setDescription] = useState(location?.description || '');
    const [latitude, setLatitude] = useState(location?.latitude.toString() || '');
    const [longitude, setLongitude] = useState(location?.longitude.toString() || '');
    const [avgCost, setAvgCost] = useState(location?.avgCost || 2);
    const [avgStayMinutes, setAvgStayMinutes] = useState(90);
    const [openHours, setOpenHours] = useState<any>(null);
    const [website, setWebsite] = useState('');
    const [menuUrl, setMenuUrl] = useState('');
    const [eventsInfo, setEventsInfo] = useState('');

    const [availableTags, setAvailableTags] = useState<Tag[]>([]);
    const [selectedTags, setSelectedTags] = useState<{ id: number; name: string; selected: boolean }[]>([]);

    const [availableCategories, setAvailableCategories] = useState<Category[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<Set<number>>(new Set());

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Fetch Categories
        fetch('http://localhost:3000/api/categories').then(res => res.json()).then(data => {
            // Filter out 'Folder'? Maybe allow it if user really wants.
            setAvailableCategories(data.filter((c: any) => c.name !== 'Folder'));
        });

        // Fetch Tags
        fetchTags().then(fetchedTags => {
            setAvailableTags(fetchedTags);
            if (location && location.tags) {
                const locationTagIds = new Set(location.tags.map(t => t.tag.id));
                setSelectedTags(fetchedTags.map(tag => ({
                    id: tag.id,
                    name: tag.name,
                    selected: locationTagIds.has(tag.id)
                })));
            } else {
                setSelectedTags(fetchedTags.map(tag => ({
                    id: tag.id,
                    name: tag.name,
                    selected: false
                })));
            }
        });

        // Init Categories for Edit
        if (location && location.categories) {
            setSelectedCategories(new Set(location.categories.map(c => c.id)));
        } else {
            setSelectedCategories(new Set());
        }

        if (location) {
            setName(location.name);
            setDescription(location.description || '');
            setLatitude(location.latitude.toString()); // Ensure string for input
            setLongitude(location.longitude.toString()); // Ensure string for input
            if (location.avgCost) setAvgCost(location.avgCost);
            if (location.avgStayMinutes) setAvgStayMinutes(location.avgStayMinutes);
            if (location.openHours) setOpenHours(location.openHours);
            if (location.website) setWebsite(location.website);
            if (location.menuUrl) setMenuUrl(location.menuUrl);
            if (location.eventsInfo) setEventsInfo(location.eventsInfo);
        } else {
            // Reset states for new location if location prop becomes null
            setName('');
            setDescription('');
            setLatitude('');
            setLongitude('');
            setAvgCost(2);
            setAvgStayMinutes(90);
            setOpenHours(null);
            setWebsite('');
            setMenuUrl('');
            setEventsInfo('');
        }
    }, [location]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = {
                name,
                description,
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude),
                tags: selectedTags.filter(t => t.selected).map(t => t.id),
                categories: Array.from(selectedCategories),
                avgCost,
                avgStayMinutes,
                openHours,
                website,
                menuUrl,
                eventsInfo
            };

            if (location) {
                await updateLocation(location.id, payload);
            } else {
                await createLocation(payload);
            }
            onSave();
            onClose();
        } catch (error) {
            console.error(error);
            alert('Failed to save location');
        } finally {
            setLoading(false);
        }
    };

    const toggleTag = (tagId: number) => {
        setSelectedTags(prev => prev.map(t =>
            t.id === tagId ? { ...t, selected: !t.selected } : t
        ));
    };

    const toggleCategory = (catId: number) => {
        const newSet = new Set(selectedCategories);
        if (newSet.has(catId)) {
            newSet.delete(catId);
        } else {
            newSet.add(catId);
        }
        setSelectedCategories(newSet);
    };

    const handleAutoCategory = () => {
        // Logic: Iterate selected tags -> find their categories -> add to selectedCategories
        const newSet = new Set(selectedCategories);
        const selectedTagIds = new Set(selectedTags.filter(t => t.selected).map(t => t.id));

        availableTags.forEach(tag => {
            if (selectedTagIds.has(tag.id) && tag.categories) {
                tag.categories.forEach(cat => {
                    if (cat.name !== 'Folder') { // Skip generic
                        newSet.add(cat.id);
                    }
                });
            }
        });
        setSelectedCategories(newSet);
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[2100] flex justify-center items-center p-4">
            <div className="glass-panel w-full max-w-lg rounded-2xl p-6 bg-[#181818] border border-white/10 shadow-2xl overflow-y-auto max-h-[90vh]">
                <h2 className="text-xl font-bold text-white mb-4">
                    {location ? 'Edit Location' : 'Add New Location'}
                </h2>

                {/* Smart Lookup */}
                {!location && (
                    <div className="mb-6 p-4 bg-brand-primary/10 border border-brand-primary/30 rounded-lg">
                        <label className="block text-xs uppercase text-brand-accent mb-2 font-bold">Smart Auto-Fill</label>
                        <div className="flex gap-2">
                            <input
                                className="flex-1 bg-black/40 border border-white/10 rounded p-2 text-white text-sm"
                                placeholder="Search place (e.g. 'Au Cheval Chicago')..."
                                onKeyDown={async (e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        // Nominatim Search
                                        const q = (e.target as HTMLInputElement).value;
                                        try {
                                            setLoading(true);
                                            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`);
                                            const data = await res.json();
                                            if (data && data.length > 0) {
                                                const first = data[0];
                                                setName(first.name || first.display_name.split(',')[0]);
                                                setLatitude(first.lat);
                                                setLongitude(first.lon);
                                                setDescription(first.display_name); // Pre-fill desc with full address
                                            } else {
                                                alert('No results found');
                                            }
                                        } catch (err) {
                                            alert('Search failed');
                                        } finally {
                                            setLoading(false);
                                        }
                                    }
                                }}
                            />
                            <button className="bg-white/10 hover:bg-white/20 px-3 py-1 rounded text-xs text-white">Search</button>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1">Powered by OpenStreetMap. Type & Hit Enter.</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs uppercase text-gray-400 mb-1">Name</label>
                        <input
                            required
                            className="w-full bg-black/40 border border-white/10 rounded p-2 text-white focus:border-brand-primary outline-none"
                            value={name}
                            onChange={e => setName(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-xs uppercase text-gray-400 mb-1">Description</label>
                        <textarea
                            className="w-full bg-black/40 border border-white/10 rounded p-2 text-white focus:border-brand-primary outline-none h-24"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs uppercase text-gray-400 mb-1">Website URL</label>
                            <input
                                className="w-full bg-black/40 border border-white/10 rounded p-2 text-white focus:border-brand-primary outline-none"
                                value={website} onChange={e => setWebsite(e.target.value)}
                                placeholder="https://..."
                            />
                        </div>
                        <div>
                            <label className="block text-xs uppercase text-gray-400 mb-1">Menu URL</label>
                            <input
                                className="w-full bg-black/40 border border-white/10 rounded p-2 text-white focus:border-brand-primary outline-none"
                                value={menuUrl} onChange={e => setMenuUrl(e.target.value)}
                                placeholder="https://..."
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs uppercase text-brand-accent mb-1 font-bold">Happy Hour / Events</label>
                        <textarea
                            className="w-full bg-brand-accent/5 border border-brand-accent/20 p-2 rounded text-white h-16 placeholder-gray-600 focus:border-brand-primary outline-none"
                            value={eventsInfo} onChange={e => setEventsInfo(e.target.value)}
                            placeholder="e.g. Happy Hour 4-6pm Mon-Fri: $5 Drafts"
                        />
                    </div>

                    <div>
                        <label className="block text-xs uppercase text-gray-400 mb-2">Operating Hours</label>
                        <div className="bg-black/20 rounded-lg p-4 border border-white/10 space-y-3">
                            {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(day => {
                                const dayConfig = (openHours as any)?.[day] || { isOpen: false, open: '09:00', close: '17:00' };
                                return (
                                    <div key={day} className="flex items-center gap-4">
                                        <div className="w-12 text-xs font-bold uppercase text-gray-400">{day}</div>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={dayConfig.isOpen}
                                                onChange={e => {
                                                    setOpenHours((prev: any) => ({ ...prev, [day]: { ...dayConfig, isOpen: e.target.checked } }));
                                                }}
                                                className="rounded border-white/20 bg-transparent text-brand-primary focus:ring-brand-primary"
                                            />
                                            <span className="text-xs text-gray-500">{dayConfig.isOpen ? 'Open' : 'Closed'}</span>
                                        </label>

                                        {dayConfig.isOpen && (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="time"
                                                    value={dayConfig.open}
                                                    onChange={e => {
                                                        setOpenHours((prev: any) => ({ ...prev, [day]: { ...dayConfig, open: e.target.value } }));
                                                    }}
                                                    className="bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white"
                                                />
                                                <span className="text-gray-600">-</span>
                                                <input
                                                    type="time"
                                                    value={dayConfig.close}
                                                    onChange={e => {
                                                        setOpenHours((prev: any) => ({ ...prev, [day]: { ...dayConfig, close: e.target.value } }));
                                                    }}
                                                    className="bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white"
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            <div className="pt-2 border-t border-white/5 flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const monday = (openHours as any)?.mon || { isOpen: true, open: '09:00', close: '17:00' };
                                        const newHours: any = {};
                                        ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].forEach(d => {
                                            newHours[d] = { ...monday };
                                        });
                                        setOpenHours(newHours);
                                    }}
                                    className="text-xs text-brand-accent hover:text-white transition"
                                >
                                    Copy Monday to All Days
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs uppercase text-gray-400 mb-1">Latitude</label>
                            <input
                                required type="number" step="any"
                                className="w-full bg-black/40 border border-white/10 rounded p-2 text-white focus:border-brand-primary outline-none"
                                value={latitude}
                                onChange={e => setLatitude(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs uppercase text-gray-400 mb-1">Longitude</label>
                            <input
                                required type="number" step="any"
                                className="w-full bg-black/40 border border-white/10 rounded p-2 text-white focus:border-brand-primary outline-none"
                                value={longitude}
                                onChange={e => setLongitude(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs uppercase text-gray-400 mb-1">Avg Cost (1-4)</label>
                            <select
                                className="w-full bg-black/40 border border-white/10 rounded p-2 text-white focus:border-brand-primary outline-none"
                                value={avgCost}
                                onChange={e => setAvgCost(Number(e.target.value))}
                            >
                                <option value="1">$</option>
                                <option value="2">$$</option>
                                <option value="3">$$$</option>
                                <option value="4">$$$$</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs uppercase text-gray-400 mb-1">Stay (min)</label>
                            <input
                                type="number"
                                className="w-full bg-black/40 border border-white/10 rounded p-2 text-white focus:border-brand-primary outline-none"
                                value={avgStayMinutes}
                                onChange={e => setAvgStayMinutes(Number(e.target.value))}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs uppercase text-gray-400 mb-2">Detailed Categories</label>
                        <div className="flex flex-wrap gap-2 mb-2 p-2 bg-black/20 rounded border border-white/5 min-h-[40px]">
                            {availableCategories.map(cat => {
                                const isSelected = selectedCategories.has(cat.id);
                                return (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => toggleCategory(cat.id)}
                                        className={`px-3 py-1 rounded-full text-xs font-bold transition border ${isSelected
                                            ? 'bg-brand-accent text-black border-brand-accent'
                                            : 'bg-white/5 text-gray-400 border-transparent hover:border-white/20'
                                            }`}
                                    >
                                        {cat.name}
                                    </button>
                                );
                            })}
                        </div>
                        {/* Auto-Suggest Button */}
                        <button
                            type="button"
                            onClick={handleAutoCategory}
                            className="text-[10px] uppercase tracking-wider text-brand-primary hover:text-white flex items-center gap-1"
                        >
                            <span className="text-lg">✨</span> Auto-Populate from Tags
                        </button>
                    </div>

                    <div>
                        <label className="block text-xs uppercase text-gray-400 mb-2">Tags</label>
                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-black/20 rounded border border-white/5">
                            {availableTags.map(tag => {
                                const tagState = selectedTags.find(t => t.id === tag.id);
                                const isSelected = tagState ? tagState.selected : false;
                                return (
                                    <button
                                        key={tag.id}
                                        type="button"
                                        onClick={() => toggleTag(tag.id)}
                                        className={`px-2 py-1 rounded text-xs border transition ${isSelected
                                            ? 'bg-brand-primary text-white border-brand-primary'
                                            : 'bg-white/5 text-gray-400 border-transparent hover:border-white/20'
                                            }`}
                                    >
                                        {tag.name}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-white/10 mt-6">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded text-gray-300 hover:text-white transition">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2 bg-brand-primary hover:bg-brand-primary/80 text-white rounded font-medium transition disabled:grayscale"
                        >
                            {loading ? 'Saving...' : 'Save Location'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LocationModal;
