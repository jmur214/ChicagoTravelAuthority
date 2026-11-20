import React, { useCallback, useMemo, useState } from 'react';
import type { Location, LocationUpdateInput } from '@cta/shared';
import { api } from '../../api/client';
import { errorMessage } from '../../api/http';
import { useApiData, useCategories, usePlacesStatus, useTags } from '../../hooks/useApiData';
import { describeFields } from '../../lib/placeLabels';
import CategoryManager from './CategoryManager';
import EnrichBatchModal from './EnrichBatchModal';
import ImportModal from './ImportModal';
import LocationModal from './LocationModal';
import LocationRow from './LocationRow';
import MatchReviewModal from './MatchReviewModal';
import TagManager from './TagManager';

type SortField = 'name' | 'id' | 'description';

/** undefined = closed, null = creating a new location */
type EditorState = Location | null | undefined;

const fetchAllLocations = () => api.locations.list(true);

const AdminDashboard: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { data: locations = [], mutate: mutateLocations, reload: reloadLocations, error: loadError } = useApiData(fetchAllLocations);
    const { data: categories = [], reload: reloadCategories } = useCategories();
    const { data: tags = [], reload: reloadTags } = useTags();

    const [search, setSearch] = useState('');
    const [sortField, setSortField] = useState<SortField>('name');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [filter, setFilter] = useState<'all' | 'pending' | 'needsMatch'>('all');
    const [editing, setEditing] = useState<EditorState>(undefined);
    const [panel, setPanel] = useState<'tags' | 'categories' | 'import' | 'enrich' | null>(null);
    const [reviewing, setReviewing] = useState<Location | null>(null);
    const [enrichingId, setEnrichingId] = useState<number | null>(null);
    const { data: placesStatus } = usePlacesStatus();
    const placesConfigured = !!placesStatus?.configured;

    const replaceLocation = useCallback(
        (updated: Location) => mutateLocations(list => (list ?? []).map(l => (l.id === updated.id ? updated : l))),
        [mutateLocations],
    );

    const update = async (id: number, patch: LocationUpdateInput) => {
        try {
            replaceLocation(await api.locations.update(id, patch));
        } catch (err) {
            alert(`Update failed: ${errorMessage(err)}`);
        }
    };

    const addCategories = (loc: Location, ids: number[]) =>
        update(loc.id, { categoryIds: [...new Set([...loc.categories.map(c => c.id), ...ids])] });

    const handleDelete = async (loc: Location) => {
        if (!confirm(`Delete "${loc.name}"?`)) return;
        try {
            await api.locations.remove(loc.id);
            mutateLocations(list => (list ?? []).filter(l => l.id !== loc.id));
        } catch (err) {
            alert(`Delete failed: ${errorMessage(err)}`);
        }
    };

    /** Match or refresh a single place from its row. */
    const enrichOne = async (loc: Location) => {
        setEnrichingId(loc.id);
        try {
            const result = await api.locations.enrich(loc.id);
            replaceLocation(result.location);
            if (result.status === 'needs_review' || result.status === 'no_match') setReviewing(result.location);
            else if (result.status === 'matched') {
                const fields = result.changes.map(c => c.field);
                alert(fields.length ? `${loc.name}: updated ${describeFields(fields)}.` : `${loc.name} is already up to date.`);
            }
        } catch (err) {
            alert(`Couldn't check ${loc.name}: ${errorMessage(err)}`);
        } finally {
            setEnrichingId(null);
        }
    };

    const handleSaved = (saved: Location) => {
        setEditing(undefined);
        if (locations.some(l => l.id === saved.id)) replaceLocation(saved);
        else mutateLocations(list => [...(list ?? []), saved]);
    };

    const closePanel = () => {
        setPanel(null);
        // Tags/categories may have changed; refresh everything that embeds them.
        reloadLocations();
        reloadCategories();
        reloadTags();
    };

    const handleSort = (field: SortField) => {
        if (sortField === field) setSortDirection(d => (d === 'asc' ? 'desc' : 'asc'));
        else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const pendingCount = locations.filter(l => !l.isConfirmed).length;
    const needsMatch = (l: Location) => l.matchStatus === 'needs_review' || l.matchStatus === 'no_match';
    const needsMatchCount = locations.filter(needsMatch).length;
    const toggleFilter = (f: 'pending' | 'needsMatch') => setFilter(cur => (cur === f ? 'all' : f));

    const visible = useMemo(() => {
        const q = search.toLowerCase();
        const dir = sortDirection === 'asc' ? 1 : -1;
        return locations
            .filter(l => filter === 'all' || (filter === 'pending' ? !l.isConfirmed : needsMatch(l)))
            .filter(l => l.name.toLowerCase().includes(q) || l.tags.some(t => t.tag.name.toLowerCase().includes(q)))
            .sort((a, b) => {
                if (sortField === 'name') return a.name.localeCompare(b.name) * dir;
                if (sortField === 'description') return (a.description ?? '').localeCompare(b.description ?? '') * dir;
                return (a.id - b.id) * dir;
            });
    }, [locations, search, filter, sortField, sortDirection]);

    const sortArrow = (field: SortField) => (sortField === field ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : '');

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
                                onClick={() => toggleFilter('pending')}
                                className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold transition ${filter === 'pending' ? 'bg-yellow-500 text-black' : 'bg-white/5 text-gray-400'}`}
                            >
                                {pendingCount} Pending Review
                            </button>
                            {needsMatchCount > 0 && (
                                <button
                                    onClick={() => toggleFilter('needsMatch')}
                                    className={`px-3 py-1 rounded-full text-xs font-bold transition ${filter === 'needsMatch' ? 'bg-yellow-500 text-black' : 'bg-white/5 text-yellow-400'}`}
                                >
                                    {needsMatchCount} Need a Google match
                                </button>
                            )}
                            <span className="w-px h-4 bg-white/10"></span>
                            <button onClick={() => setPanel('tags')} className="text-gray-400 hover:text-white transition">Manage Tags</button>
                            <button onClick={() => setPanel('categories')} className="text-brand-accent hover:text-white transition font-bold">Manage Categories</button>
                            <button onClick={() => setPanel('import')} className="text-gray-400 hover:text-white transition">Import KML</button>
                            {placesStatus && (
                                placesConfigured ? (
                                    <button onClick={() => setPanel('enrich')} className="text-brand-primary hover:text-white transition font-bold">
                                        Match & enrich
                                    </button>
                                ) : (
                                    <span className="text-xs text-gray-500" title="Add GOOGLE_PLACES_KEY to server/.env and restart the server to fill in hours, addresses and more from Google.">
                                        Google Places not set up ⓘ
                                    </span>
                                )
                            )}
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
                        onClick={() => setEditing(null)}
                        className="px-4 py-2 bg-brand-primary text-white rounded-lg font-medium shadow-lg hover:bg-brand-primary/80 transition"
                    >
                        + Add New Location
                    </button>
                    <div className="ml-auto text-sm text-gray-400 self-center">{visible.length} locations found</div>
                </div>

                {loadError && (
                    <div className="px-6 py-3 bg-red-900/30 text-red-300 text-sm">Couldn't load locations: {errorMessage(loadError)}</div>
                )}

                {/* Table */}
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-[#1a1a1a] sticky top-0 z-10 text-xs uppercase text-gray-400">
                            <tr>
                                <th className="p-4 font-semibold cursor-pointer hover:text-white transition" onClick={() => handleSort('name')}>Name{sortArrow('name')}</th>
                                <th className="p-4 font-semibold cursor-pointer hover:text-white transition" onClick={() => handleSort('description')}>Description{sortArrow('description')}</th>
                                <th className="p-4 font-semibold">Status</th>
                                <th className="p-4 font-semibold">Price</th>
                                <th className="p-4 font-semibold">Stay</th>
                                <th className="p-4 font-semibold">Tags</th>
                                <th className="p-4 font-semibold">Category(s)</th>
                                <th className="p-4 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {visible.map(loc => (
                                <LocationRow
                                    key={loc.id}
                                    location={loc}
                                    allCategories={categories}
                                    allTags={tags}
                                    onApprove={() => update(loc.id, { isConfirmed: true })}
                                    onSetVibe={verified => update(loc.id, { verifiedVibe: verified })}
                                    onAddCategories={ids => addCategories(loc, ids)}
                                    onEdit={() => setEditing(loc)}
                                    onDelete={() => handleDelete(loc)}
                                    places={placesConfigured ? {
                                        busy: enrichingId === loc.id,
                                        onEnrich: () => enrichOne(loc),
                                        onReview: () => setReviewing(loc),
                                    } : undefined}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {editing !== undefined && (
                <LocationModal
                    key={editing?.id ?? 'new'}
                    location={editing}
                    onClose={() => setEditing(undefined)}
                    onSaved={handleSaved}
                    placesConfigured={placesConfigured}
                    onCreatedFromPlace={created => {
                        mutateLocations(list => [...(list ?? []), created]);
                        // Continue in the editor to add tags and categories.
                        setEditing(created);
                    }}
                />
            )}
            {panel === 'tags' && <TagManager onClose={closePanel} />}
            {panel === 'categories' && <CategoryManager onClose={closePanel} />}
            {panel === 'import' && <ImportModal onClose={closePanel} />}
            {panel === 'enrich' && <EnrichBatchModal locations={locations} onUpdated={replaceLocation} onClose={() => setPanel(null)} />}
            {reviewing && (
                <MatchReviewModal
                    location={reviewing}
                    onClose={() => setReviewing(null)}
                    onResolved={updated => {
                        replaceLocation(updated);
                        setReviewing(updated);
                    }}
                />
            )}
        </div>
    );
};

export default AdminDashboard;
