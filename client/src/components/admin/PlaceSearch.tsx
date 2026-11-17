import React, { useState } from 'react';
import { geocodePlace, type GeocodeResult } from '../../lib/geocode';

/** "Smart Auto-Fill": look up a place on OpenStreetMap and hand back name/coords/address. */
const PlaceSearch: React.FC<{ onFound: (place: GeocodeResult) => void }> = ({ onFound }) => {
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState<'idle' | 'searching' | 'not-found' | 'error'>('idle');

    const search = async () => {
        if (!query.trim()) return;
        setStatus('searching');
        try {
            const place = await geocodePlace(query);
            if (place) {
                onFound(place);
                setStatus('idle');
            } else {
                setStatus('not-found');
            }
        } catch {
            setStatus('error');
        }
    };

    return (
        <div className="mb-6 p-4 bg-brand-primary/10 border border-brand-primary/30 rounded-lg">
            <label className="block text-xs uppercase text-brand-accent mb-2 font-bold">Smart Auto-Fill</label>
            <div className="flex gap-2">
                <input
                    className="flex-1 bg-black/40 border border-white/10 rounded p-2 text-white text-sm"
                    placeholder="Search place (e.g. 'Au Cheval Chicago')..."
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            void search();
                        }
                    }}
                />
                <button
                    type="button"
                    onClick={() => void search()}
                    disabled={status === 'searching'}
                    className="bg-white/10 hover:bg-white/20 px-3 py-1 rounded text-xs text-white disabled:opacity-50"
                >
                    {status === 'searching' ? '…' : 'Search'}
                </button>
            </div>
            <p className="text-[10px] text-gray-500 mt-1">
                {status === 'not-found' && <span className="text-yellow-500">No results. </span>}
                {status === 'error' && <span className="text-red-400">Search failed. </span>}
                Powered by OpenStreetMap.
            </p>
        </div>
    );
};

export default PlaceSearch;
