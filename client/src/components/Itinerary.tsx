import React from 'react';
import type { TransportMode } from '@cta/shared';
import { formatClockTime } from '../lib/datetime';
import type { Plan } from '../lib/plan';
import { TRANSPORT_OPTIONS, transportIcon } from '../lib/transport';

interface ItineraryProps {
    plan: Plan;
    onSelect: (locationId: number) => void;
    onRemove: (locationId: number) => void;
    onMove: (index: number, delta: -1 | 1) => void;
    onChangeMode: (mode: TransportMode) => void;
    onClear: () => void;
}

const iconButton = 'w-7 h-7 flex items-center justify-center rounded-full text-gray-500 hover:text-white hover:bg-white/10 transition disabled:opacity-20 disabled:pointer-events-none';

const Itinerary: React.FC<ItineraryProps> = ({ plan, onSelect, onRemove, onMove, onChangeMode, onClear }) => {
    const { items } = plan;
    const last = items[items.length - 1];

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center mb-3 border-b border-white/10 pb-3 shrink-0">
                <div>
                    <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Your Night</h2>
                    <p className="text-[11px] text-gray-500">
                        {formatClockTime(plan.startTime)} – {formatClockTime(last.departureTime)} · {items.length} stop{items.length === 1 ? '' : 's'}
                    </p>
                </div>
                <div className="flex items-center gap-1">
                    <div className="flex bg-white/5 rounded-full p-0.5" role="group" aria-label="Getting around">
                        {TRANSPORT_OPTIONS.map(o => (
                            <button
                                key={o.mode}
                                onClick={() => onChangeMode(o.mode)}
                                aria-pressed={plan.transportMode === o.mode}
                                title={o.label}
                                className={`w-8 h-8 rounded-full text-sm transition ${plan.transportMode === o.mode ? 'bg-white/20' : 'opacity-50 hover:opacity-100'}`}
                            >
                                {o.icon}
                            </button>
                        ))}
                    </div>
                    <button onClick={onClear} className="ml-2 text-xs text-red-400 hover:text-red-300 uppercase tracking-widest font-bold">Clear</button>
                </div>
            </div>

            {/* Stops */}
            <div className="overflow-y-auto flex-1 min-h-0 pr-1 custom-scrollbar space-y-4 pt-2 pb-6 relative">
                <div className="absolute left-[19px] top-6 bottom-0 w-0.5 bg-gradient-to-b from-brand-primary via-brand-accent to-transparent opacity-50 z-0"></div>

                {items.map((item, index) => (
                    <div key={item.locationId} className="relative z-10">
                        <div className={`absolute left-0 top-6 w-10 h-10 rounded-full border-4 border-[#050505] shadow shadow-brand-primary/50 flex items-center justify-center z-20 ${index === 0 ? 'bg-brand-primary text-white' : 'bg-[#1a1a1a] text-gray-400'}`}>
                            <span className="text-[10px] font-bold">{index + 1}</span>
                        </div>

                        <div className="ml-12 bg-[#121212] border border-white/10 rounded-2xl overflow-hidden shadow-lg group">
                            <div className={`h-1.5 w-full ${index === 0 ? 'bg-brand-primary' : 'bg-brand-accent/50'}`}></div>

                            <div className="p-4">
                                <div className="flex justify-between items-start mb-1">
                                    <span className="text-xs font-bold text-gray-400 font-mono tracking-widest uppercase">
                                        {formatClockTime(item.arrivalTime)}
                                    </span>
                                    {item.travelTimeMinutes > 0 && (
                                        <span className="flex items-center gap-1 text-[10px] text-gray-500">
                                            <span>{transportIcon(item.travelMode)}</span>
                                            <span>{item.travelTimeMinutes}m</span>
                                        </span>
                                    )}
                                </div>

                                <h3 className="text-lg font-bold text-white leading-tight mb-2 group-hover:text-brand-accent transition-colors">
                                    {item.name}
                                </h3>

                                {item.isOpenOnArrival === false && (
                                    <p className="text-[11px] font-bold text-red-400 bg-red-900/20 border border-red-500/20 rounded px-2 py-1 mb-2">
                                        ⚠ Closed when you'd arrive
                                    </p>
                                )}

                                <div className="bg-white/5 rounded-lg p-2 mb-2">
                                    <p className="text-xs text-gray-300 italic leading-relaxed">"{item.reason}"</p>
                                </div>

                                <div className="flex justify-between items-center gap-2">
                                    {item.matchScore > 0 ? (
                                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${item.matchScore > 80 ? 'text-green-400 bg-green-900/30' : 'text-gray-400 bg-white/5'}`}>
                                            {item.matchScore}% Vibe Match
                                        </span>
                                    ) : <span />}

                                    <div className="flex items-center">
                                        <button onClick={() => onMove(index, -1)} disabled={index === 0} className={iconButton} aria-label={`Move ${item.name} earlier`}>↑</button>
                                        <button onClick={() => onMove(index, 1)} disabled={index === items.length - 1} className={iconButton} aria-label={`Move ${item.name} later`}>↓</button>
                                        <button onClick={() => onRemove(item.locationId)} className={`${iconButton} hover:text-red-400`} aria-label={`Remove ${item.name}`}>✕</button>
                                        <button onClick={() => onSelect(item.locationId)} className="ml-1 text-[10px] uppercase font-bold text-gray-500 hover:text-white transition">
                                            Details &gt;
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                <div className="flex items-center gap-4 ml-1 opacity-50">
                    <div className="w-8 h-8 rounded-full bg-[#121212] border-2 border-white/20 flex items-center justify-center z-10">
                        <span className="text-xs">🏁</span>
                    </div>
                    <span className="text-xs text-gray-500 font-mono tracking-widest uppercase">Night Complete · {formatClockTime(last.departureTime)}</span>
                </div>
            </div>
        </div>
    );
};

export default Itinerary;
