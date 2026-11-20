import React, { useState } from 'react';
import type { Location, ScoredCandidate } from '@cta/shared';
import { api } from '../../api/client';
import { errorMessage } from '../../api/http';
import { describeFields } from '../../lib/placeLabels';
import CandidateList from './CandidateList';

interface MatchReviewModalProps {
    location: Location;
    onClose: () => void;
    onResolved: (location: Location) => void;
}

/**
 * Pick the right Google listing for a place the matcher wasn't sure about —
 * from its suggestions, or from a fresh search near the place.
 */
const MatchReviewModal: React.FC<MatchReviewModalProps> = ({ location, onClose, onResolved }) => {
    const [candidates, setCandidates] = useState<ScoredCandidate[]>(location.matchCandidates ?? []);
    const [query, setQuery] = useState(location.name);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const near = { lat: location.latitude, lng: location.longitude };

    const run = async (key: string, fn: () => Promise<void>) => {
        setBusy(key);
        setError(null);
        try {
            await fn();
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setBusy(null);
        }
    };

    const search = () => run('search', async () => setCandidates(await api.places.search(query, near)));

    const pick = (c: ScoredCandidate) =>
        run(c.externalId, async () => {
            const result = await api.locations.match(location.id, c.externalId);
            const fields = result.changes.map(ch => ch.field);
            setNotice(fields.length ? `Matched — updated ${describeFields(fields)}.` : 'Matched — already up to date.');
            onResolved(result.location);
        });

    const ignore = () =>
        run('ignore', async () => {
            onResolved((await api.locations.ignoreMatch(location.id)).location);
            onClose();
        });

    return (
        <div className="fixed inset-0 z-[10002] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#151515] border border-white/10 rounded-2xl p-6 shadow-2xl">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-xl font-bold text-white">Which listing is “{location.name}”?</h2>
                        <p className="text-xs text-gray-500 mt-1">
                            {location.matchStatus === 'no_match'
                                ? "Nothing nearby looked like a confident match. Search with a different name, or mark it as not on Google."
                                : 'More than one listing could be this place. Pick the right one — its hours, phone and website will be filled in.'}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-sm">✕</button>
                </div>

                <div className="flex gap-2 mb-4">
                    <input
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && search()}
                        className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                        aria-label="Search Google near this place"
                    />
                    <button onClick={search} disabled={!!busy || query.trim().length < 2} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm disabled:opacity-40">
                        {busy === 'search' ? 'Searching…' : 'Search nearby'}
                    </button>
                </div>

                {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
                {notice && <p className="text-sm text-green-400 mb-3">{notice}</p>}

                <CandidateList candidates={candidates} actionLabel="This one" busyId={busy} onPick={pick} emptyText="No listings found nearby." />

                <div className="flex justify-between items-center mt-6 pt-4 border-t border-white/10">
                    <button onClick={ignore} disabled={!!busy} className="text-xs text-gray-400 hover:text-white underline decoration-dotted">
                        Not on Google — stop suggesting matches
                    </button>
                    <button onClick={onClose} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm">Done</button>
                </div>
            </div>
        </div>
    );
};

export default MatchReviewModal;
