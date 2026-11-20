import React from 'react';
import { describeDayHours, getZonedDayAndMinutes, type ScoredCandidate } from '@cta/shared';
import { businessStatusLabel, confidenceStyle, formatDistance } from '../../lib/placeLabels';

interface CandidateListProps {
    candidates: ScoredCandidate[];
    actionLabel: string;
    busyId?: string | null;
    onPick: (candidate: ScoredCandidate) => void;
    emptyText?: string;
}

const CONFIDENCE_TEXT = { high: 'Strong match', medium: 'Possible match', low: 'Unlikely' } as const;

/** Google results with the evidence needed to judge a match: distance, name similarity, address, hours. */
const CandidateList: React.FC<CandidateListProps> = ({ candidates, actionLabel, busyId, onPick, emptyText = 'No results.' }) => {
    if (!candidates.length) return <p className="text-sm text-gray-500 py-4 text-center">{emptyText}</p>;
    const today = getZonedDayAndMinutes(new Date()).day;

    return (
        <ul className="flex flex-col gap-2">
            {candidates.map(c => {
                const closed = businessStatusLabel(c.businessStatus);
                return (
                    <li key={c.externalId} className="bg-black/30 border border-white/10 rounded-xl p-3 flex gap-3 items-start">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-white">{c.name}</span>
                                {c.distanceMeters !== null && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${confidenceStyle[c.confidence]}`}>
                                        {CONFIDENCE_TEXT[c.confidence]}
                                    </span>
                                )}
                                {closed && <span className="text-[10px] px-1.5 py-0.5 rounded border border-red-500/40 text-red-400">{closed}</span>}
                            </div>
                            <p className="text-xs text-gray-400 truncate">{c.address ?? 'No address listed'}</p>
                            <p className="text-[11px] text-gray-500 mt-1 flex flex-wrap gap-x-3">
                                {c.distanceMeters !== null && <span>{formatDistance(c.distanceMeters)}</span>}
                                <span>name match {Math.round(c.nameScore * 100)}%</span>
                                {c.rating !== null && <span>★ {c.rating.toFixed(1)}{c.reviewCount ? ` (${c.reviewCount.toLocaleString()})` : ''}</span>}
                                <span>today: {c.openHours ? describeDayHours(c.openHours[today]) : 'hours unknown'}</span>
                            </p>
                        </div>
                        <button
                            onClick={() => onPick(c)}
                            disabled={!!busyId}
                            className="shrink-0 px-3 py-1.5 rounded-lg bg-brand-primary text-white text-xs font-bold hover:bg-brand-primary/80 disabled:opacity-40"
                        >
                            {busyId === c.externalId ? '…' : actionLabel}
                        </button>
                    </li>
                );
            })}
        </ul>
    );
};

export default CandidateList;
