import React, { useState } from 'react';
import type { Location, ScoredCandidate } from '@cta/shared';
import { api } from '../../api/client';
import { errorMessage } from '../../api/http';
import CandidateList from './CandidateList';

/** Adding a place: search Google, pick the listing, and it's created with real details. */
const GooglePlaceSearch: React.FC<{ onCreated: (location: Location) => void }> = ({ onCreated }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<ScoredCandidate[] | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const search = async () => {
        if (query.trim().length < 2) return;
        setBusy('search');
        setError(null);
        try {
            setResults(await api.places.search(query));
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setBusy(null);
        }
    };

    const add = async (c: ScoredCandidate) => {
        setBusy(c.externalId);
        setError(null);
        try {
            onCreated((await api.locations.createFromPlace({ externalId: c.externalId, isConfirmed: true })).location);
        } catch (err) {
            setError(errorMessage(err));
            setBusy(null);
        }
    };

    return (
        <div className="mb-6 p-4 bg-brand-primary/10 border border-brand-primary/30 rounded-lg">
            <label className="block text-xs uppercase text-brand-accent mb-2 font-bold" htmlFor="google-place-search">Find it on Google</label>
            <div className="flex gap-2 mb-3">
                <input
                    id="google-place-search"
                    className="flex-1 bg-black/40 border border-white/10 rounded p-2 text-white text-sm"
                    placeholder="e.g. Au Cheval, or 'tacos Pilsen'"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            void search();
                        }
                    }}
                />
                <button type="button" onClick={() => void search()} disabled={!!busy} className="bg-white/10 hover:bg-white/20 px-3 py-1 rounded text-xs text-white disabled:opacity-40">
                    {busy === 'search' ? '…' : 'Search'}
                </button>
            </div>
            {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
            {results && <CandidateList candidates={results} actionLabel="Add" busyId={busy} onPick={add} emptyText="Nothing found in Chicago." />}
            <p className="text-[10px] text-gray-500 mt-2">Hours, address, phone, website, price and rating come straight from the Google listing. Or fill in the form below by hand.</p>
        </div>
    );
};

export default GooglePlaceSearch;
