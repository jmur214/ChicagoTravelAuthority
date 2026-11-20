import React, { useState } from 'react';
import { LocationCreateSchema, type Location, type LocationCreateInput, type OpenHours } from '@cta/shared';
import { api } from '../../api/client';
import { ApiError, errorMessage } from '../../api/http';
import { useCategories, useTags } from '../../hooks/useApiData';
import { visibleCategories } from '../../lib/categories';
import { formatDate, sourceHint } from '../../lib/placeLabels';
import GooglePlaceSearch from './GooglePlaceSearch';
import OpenHoursEditor from './OpenHoursEditor';
import PlaceSearch from './PlaceSearch';

interface LocationModalProps {
    /** null = create a new location */
    location: Location | null;
    onClose: () => void;
    onSaved: (location: Location) => void;
    /** Google Places is configured: offer "Find it on Google" when adding */
    placesConfigured?: boolean;
    onCreatedFromPlace?: (location: Location) => void;
}

interface FormState {
    name: string;
    description: string;
    address: string;
    phoneNumber: string;
    latitude: string;
    longitude: string;
    website: string;
    menuUrl: string;
    eventsInfo: string;
    /** null = unknown */
    avgCost: number | null;
    avgStayMinutes: number;
    openHours: OpenHours | null;
    tagIds: Set<number>;
    categoryIds: Set<number>;
}

const initialForm = (loc: Location | null): FormState => ({
    name: loc?.name ?? '',
    description: loc?.description ?? '',
    address: loc?.address ?? '',
    phoneNumber: loc?.phoneNumber ?? '',
    latitude: loc ? String(loc.latitude) : '',
    longitude: loc ? String(loc.longitude) : '',
    website: loc?.website ?? '',
    menuUrl: loc?.menuUrl ?? '',
    eventsInfo: loc?.eventsInfo ?? '',
    // Don't invent a price: saving a default would be recorded as your choice.
    avgCost: loc ? loc.avgCost : null,
    avgStayMinutes: loc?.avgStayMinutes ?? 90,
    openHours: loc?.openHours ?? null,
    tagIds: new Set(loc?.tags.map(t => t.tag.id)),
    categoryIds: new Set(loc?.categories.map(c => c.id)),
});

const parseCoord = (v: string) => (v.trim() === '' ? Number.NaN : Number(v));

const toPayload = (f: FormState): LocationCreateInput => ({
    name: f.name,
    description: f.description,
    address: f.address,
    phoneNumber: f.phoneNumber,
    latitude: parseCoord(f.latitude),
    longitude: parseCoord(f.longitude),
    website: f.website,
    menuUrl: f.menuUrl,
    eventsInfo: f.eventsInfo,
    avgCost: f.avgCost,
    avgStayMinutes: f.avgStayMinutes,
    openHours: f.openHours,
    tagIds: [...f.tagIds],
    categoryIds: [...f.categoryIds],
});

const inputClass = 'w-full bg-black/40 border border-white/10 rounded p-2 text-white focus:border-brand-primary outline-none';

const Field: React.FC<{ label: string; error?: string; hint?: string | null; className?: string; children: React.ReactNode }> = ({ label, error, hint, className, children }) => (
    <div className={className}>
        <label className="block text-xs uppercase text-gray-400 mb-1">
            {label}
            {hint && <span className="ml-2 normal-case text-[10px] text-gray-600">{hint}</span>}
        </label>
        {children}
        {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
);

const toggle = (set: Set<number>, id: number) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
};

const LocationModal: React.FC<LocationModalProps> = ({ location, onClose, onSaved, placesConfigured, onCreatedFromPlace }) => {
    const [form, setForm] = useState(() => initialForm(location));
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    const { data: tags = [] } = useTags();
    const { data: allCategories = [] } = useCategories();
    const categories = visibleCategories(allCategories);

    const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm(f => ({ ...f, [key]: value }));
    const hint = (field: Parameters<typeof sourceHint>[1]) => sourceHint(location?.fieldSources, field);

    /** Add every category linked to the selected tags. */
    const autoCategorize = () => {
        const next = new Set(form.categoryIds);
        for (const tag of tags) {
            if (!form.tagIds.has(tag.id)) continue;
            for (const cat of visibleCategories(tag.categories ?? [])) next.add(cat.id);
        }
        set('categoryIds', next);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = toPayload(form);

        // Same rules the server enforces — catch mistakes before the round trip.
        const check = LocationCreateSchema.safeParse(payload);
        if (!check.success) {
            setErrors(Object.fromEntries(check.error.issues.map(i => [String(i.path[0]), i.message])));
            return;
        }

        setErrors({});
        setSaving(true);
        try {
            const saved = location ? await api.locations.update(location.id, payload) : await api.locations.create(payload);
            onSaved(saved);
        } catch (err) {
            if (err instanceof ApiError && err.fieldErrors.length) {
                setErrors(Object.fromEntries(err.fieldErrors.map(f => [f.path.split('.')[0], f.message])));
            } else {
                alert(`Failed to save location: ${errorMessage(err)}`);
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[2100] flex justify-center items-center p-4">
            <div className="glass-panel w-full max-w-lg rounded-2xl p-6 bg-[#181818] border border-white/10 shadow-2xl overflow-y-auto max-h-[90vh]">
                <h2 className="text-xl font-bold text-white mb-4">{location ? 'Edit Location' : 'Add New Location'}</h2>

                {location?.matchStatus === 'matched' && (
                    <p className="text-xs text-gray-400 -mt-2 mb-4">
                        <span className="text-green-400">●</span> Linked to Google · updated {formatDate(location.enrichedAt)}
                        {location.googleMapsUrl && (
                            <> · <a href={location.googleMapsUrl} target="_blank" rel="noreferrer" className="text-brand-accent hover:underline">View on Google Maps</a></>
                        )}
                        <span className="block text-gray-600 mt-0.5">Anything you change here is kept when Google data is refreshed.</span>
                    </p>
                )}

                {!location && placesConfigured && onCreatedFromPlace && <GooglePlaceSearch onCreated={onCreatedFromPlace} />}

                {!location && !placesConfigured && (
                    <PlaceSearch
                        onFound={place =>
                            setForm(f => ({
                                ...f,
                                name: place.name,
                                latitude: String(place.latitude),
                                longitude: String(place.longitude),
                                address: place.address,
                            }))
                        }
                    />
                )}

                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                    <Field label="Name" error={errors.name}>
                        <input className={inputClass} value={form.name} onChange={e => set('name', e.target.value)} />
                    </Field>

                    <Field label="Description" error={errors.description} hint={hint('description')}>
                        <textarea className={`${inputClass} h-24`} value={form.description} onChange={e => set('description', e.target.value)} />
                    </Field>

                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Address" error={errors.address} hint={hint('address')}>
                            <input className={inputClass} value={form.address} onChange={e => set('address', e.target.value)} />
                        </Field>
                        <Field label="Phone" error={errors.phoneNumber} hint={hint('phoneNumber')}>
                            <input type="tel" className={inputClass} value={form.phoneNumber} onChange={e => set('phoneNumber', e.target.value)} />
                        </Field>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Website URL" error={errors.website} hint={hint('website')}>
                            <input className={inputClass} value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://..." />
                        </Field>
                        <Field label="Menu URL" error={errors.menuUrl}>
                            <input className={inputClass} value={form.menuUrl} onChange={e => set('menuUrl', e.target.value)} placeholder="https://..." />
                        </Field>
                    </div>

                    <div>
                        <label className="block text-xs uppercase text-brand-accent mb-1 font-bold">Happy Hour / Events</label>
                        <textarea
                            className="w-full bg-brand-accent/5 border border-brand-accent/20 p-2 rounded text-white h-16 placeholder-gray-600 focus:border-brand-primary outline-none"
                            value={form.eventsInfo}
                            onChange={e => set('eventsInfo', e.target.value)}
                            placeholder="e.g. Happy Hour 4-6pm Mon-Fri: $5 Drafts"
                        />
                    </div>

                    <Field label="Operating Hours" error={errors.openHours} hint={hint('openHours')}>
                        <OpenHoursEditor value={form.openHours} onChange={hours => set('openHours', hours)} />
                    </Field>

                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Latitude" error={errors.latitude}>
                            <input type="number" step="any" className={inputClass} value={form.latitude} onChange={e => set('latitude', e.target.value)} />
                        </Field>
                        <Field label="Longitude" error={errors.longitude}>
                            <input type="number" step="any" className={inputClass} value={form.longitude} onChange={e => set('longitude', e.target.value)} />
                        </Field>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Price" error={errors.avgCost} hint={hint('avgCost')}>
                            <select
                                className={inputClass}
                                value={form.avgCost ?? ''}
                                onChange={e => set('avgCost', e.target.value === '' ? null : Number(e.target.value))}
                            >
                                <option value="">Unknown</option>
                                {[1, 2, 3, 4].map(n => (
                                    <option key={n} value={n}>{'$'.repeat(n)}</option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Stay (min)" error={errors.avgStayMinutes}>
                            <input type="number" className={inputClass} value={form.avgStayMinutes} onChange={e => set('avgStayMinutes', Number(e.target.value))} />
                        </Field>
                    </div>

                    <div>
                        <label className="block text-xs uppercase text-gray-400 mb-2">Detailed Categories</label>
                        <div className="flex flex-wrap gap-2 mb-2 p-2 bg-black/20 rounded border border-white/5 min-h-[40px]">
                            {categories.map(cat => {
                                const selected = form.categoryIds.has(cat.id);
                                return (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => set('categoryIds', toggle(form.categoryIds, cat.id))}
                                        className={`px-3 py-1 rounded-full text-xs font-bold transition border ${selected
                                            ? 'bg-brand-accent text-black border-brand-accent'
                                            : 'bg-white/5 text-gray-400 border-transparent hover:border-white/20'}`}
                                    >
                                        {cat.name}
                                    </button>
                                );
                            })}
                        </div>
                        <button
                            type="button"
                            onClick={autoCategorize}
                            className="text-[10px] uppercase tracking-wider text-brand-primary hover:text-white flex items-center gap-1"
                        >
                            <span className="text-lg">✨</span> Auto-Populate from Tags
                        </button>
                    </div>

                    <div>
                        <label className="block text-xs uppercase text-gray-400 mb-2">Tags</label>
                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-black/20 rounded border border-white/5">
                            {tags.map(tag => {
                                const selected = form.tagIds.has(tag.id);
                                return (
                                    <button
                                        key={tag.id}
                                        type="button"
                                        onClick={() => set('tagIds', toggle(form.tagIds, tag.id))}
                                        className={`px-2 py-1 rounded text-xs border transition ${selected
                                            ? 'bg-brand-primary text-white border-brand-primary'
                                            : 'bg-white/5 text-gray-400 border-transparent hover:border-white/20'}`}
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
                            disabled={saving}
                            className="px-6 py-2 bg-brand-primary hover:bg-brand-primary/80 text-white rounded font-medium transition disabled:grayscale"
                        >
                            {saving ? 'Saving...' : 'Save Location'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LocationModal;
