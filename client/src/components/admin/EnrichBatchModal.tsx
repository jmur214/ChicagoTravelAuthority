import React, { useRef, useState } from 'react';
import type { EnrichableField, Location, MatchStatus } from '@cta/shared';
import { api } from '../../api/client';
import { errorMessage } from '../../api/http';
import { describeFields } from '../../lib/placeLabels';

interface EnrichBatchModalProps {
    locations: Location[];
    onUpdated: (location: Location) => void;
    onClose: () => void;
}

type Outcome = MatchStatus | 'error';
interface LogEntry { id: number; name: string; outcome: Outcome; detail: string }

const REFRESH_AFTER_DAYS = 60;
const PAUSE_MS = 150;

const OUTCOME_STYLE: Record<Outcome, string> = {
    matched: 'text-green-400',
    needs_review: 'text-yellow-400',
    no_match: 'text-gray-400',
    ignored: 'text-gray-500',
    unmatched: 'text-gray-500',
    error: 'text-red-400',
};
const OUTCOME_TEXT: Record<Outcome, string> = {
    matched: 'Matched',
    needs_review: 'Needs review',
    no_match: 'No match',
    ignored: 'Skipped',
    unmatched: '—',
    error: 'Error',
};

const isStale = (l: Location) =>
    l.matchStatus === 'matched' && (!l.enrichedAt || Date.now() - Date.parse(l.enrichedAt) > REFRESH_AFTER_DAYS * 86_400_000);

/** Runs matching one place at a time from the browser: visible progress, stoppable, resumable. */
const EnrichBatchModal: React.FC<EnrichBatchModalProps> = ({ locations, onUpdated, onClose }) => {
    const [includeStale, setIncludeStale] = useState(true);
    const [running, setRunning] = useState(false);
    const [log, setLog] = useState<LogEntry[]>([]);
    const [fatal, setFatal] = useState<string | null>(null);
    const stopRef = useRef(false);

    const unmatched = locations.filter(l => l.matchStatus === 'unmatched');
    const stale = locations.filter(isStale);
    const targets = [...unmatched, ...(includeStale ? stale : [])];
    const [total, setTotal] = useState(0);

    const start = async () => {
        const queue = targets;
        stopRef.current = false;
        setRunning(true);
        setFatal(null);
        setLog([]);
        setTotal(queue.length);

        for (const loc of queue) {
            if (stopRef.current) break;
            let entry: LogEntry;
            try {
                const result = await api.locations.enrich(loc.id);
                onUpdated(result.location);
                const fields = result.changes.map(c => c.field as EnrichableField);
                entry = {
                    id: loc.id,
                    name: loc.name,
                    outcome: result.status,
                    detail: result.status === 'matched'
                        ? fields.length ? `updated ${describeFields(fields)}` : 'already up to date'
                        : result.candidates.length ? `${result.candidates.length} possible listing(s)` : 'nothing found nearby',
                };
            } catch (err) {
                const message = errorMessage(err);
                entry = { id: loc.id, name: loc.name, outcome: 'error', detail: message };
                // A bad key or exhausted quota will fail every request — stop instead of hammering.
                if (/rejected the API key|quota|NOT_CONFIGURED|not set up/i.test(message)) {
                    setFatal(message);
                    stopRef.current = true;
                }
            }
            setLog(prev => [entry, ...prev]);
            await new Promise(r => setTimeout(r, PAUSE_MS));
        }
        setRunning(false);
    };

    const done = log.length;
    const counts = log.reduce<Partial<Record<Outcome, number>>>((acc, e) => ({ ...acc, [e.outcome]: (acc[e.outcome] ?? 0) + 1 }), {});

    return (
        <div className="fixed inset-0 z-[10002] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-[#151515] border border-white/10 rounded-2xl p-6 shadow-2xl">
                <h2 className="text-xl font-bold text-white">Match & enrich with Google</h2>
                <p className="text-sm text-gray-400 mt-1">
                    Each place is looked up near its saved location. Confident matches get real hours, address, phone, website,
                    price and rating; uncertain ones are left for you to review. Fields you've edited by hand are never overwritten.
                </p>

                {!running && done === 0 && (
                    <div className="mt-5 space-y-3">
                        <p className="text-white"><b>{unmatched.length}</b> place{unmatched.length === 1 ? '' : 's'} not checked yet.</p>
                        <label className="flex items-center gap-2 text-sm text-gray-300">
                            <input type="checkbox" checked={includeStale} onChange={e => setIncludeStale(e.target.checked)} />
                            Also refresh {stale.length} matched place{stale.length === 1 ? '' : 's'} not updated in {REFRESH_AFTER_DAYS}+ days (hours change)
                        </label>
                        <p className="text-xs text-gray-500">About one Google request per place.</p>
                    </div>
                )}

                {(running || done > 0) && (
                    <div className="mt-5">
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                            <span>{running ? `Checking ${Math.min(done + 1, total)} of ${total}…` : `Checked ${done} of ${total}`}</span>
                            <span>
                                {(['matched', 'needs_review', 'no_match', 'error'] as Outcome[])
                                    .filter(o => counts[o])
                                    .map(o => `${counts[o]} ${OUTCOME_TEXT[o].toLowerCase()}`)
                                    .join(' · ')}
                            </span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-brand-primary transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
                        </div>
                    </div>
                )}

                {fatal && <p className="mt-4 text-sm text-red-400">Stopped: {fatal}</p>}

                {log.length > 0 && (
                    <ul className="mt-4 flex-1 min-h-0 overflow-y-auto custom-scrollbar divide-y divide-white/5 text-sm" aria-label="Results">
                        {log.map(e => (
                            <li key={e.id} className="py-2 flex gap-3">
                                <span className={`w-24 shrink-0 font-bold ${OUTCOME_STYLE[e.outcome]}`}>{OUTCOME_TEXT[e.outcome]}</span>
                                <span className="text-white shrink-0 max-w-[40%] truncate">{e.name}</span>
                                <span className="text-gray-500 truncate">{e.detail}</span>
                            </li>
                        ))}
                    </ul>
                )}

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/10">
                    {running ? (
                        <button onClick={() => (stopRef.current = true)} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm">Stop</button>
                    ) : (
                        <>
                            <button onClick={onClose} className="px-4 py-2 rounded-lg text-gray-300 hover:text-white text-sm">
                                {done ? 'Done' : 'Cancel'}
                            </button>
                            {done === 0 && (
                                <button
                                    onClick={start}
                                    disabled={targets.length === 0}
                                    className="px-5 py-2 rounded-lg bg-brand-primary text-white font-bold text-sm hover:bg-brand-primary/80 disabled:opacity-40"
                                >
                                    Check {targets.length} place{targets.length === 1 ? '' : 's'}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EnrichBatchModal;
