import React from 'react';
import type { ItineraryItem } from '@cta/shared';
import { formatClockTime } from '../lib/datetime';

interface ItineraryProps {
    items: ItineraryItem[];
}

const Itinerary: React.FC<ItineraryProps> = ({ items }) => {
    return (
        <div className="flex flex-col h-full bg-transparent overflow-hidden px-1">
            <div className="overflow-y-auto h-full pr-1 custom-scrollbar space-y-4 pt-2 pb-6 relative">

                {/* Connecting Line (Absolute Background) */}
                <div className="absolute left-[19px] top-6 bottom-0 w-0.5 bg-gradient-to-b from-brand-primary via-brand-accent to-transparent opacity-50 z-0"></div>

                {items.map((item, index) => (
                    <div
                        key={item.order}
                        className="relative z-10 transition-all duration-300 hover:scale-[1.02] hover:z-20 cursor-default"
                        style={{ perspective: '1000px' }}
                    >
                        {/* Timeline Node */}
                        <div className={`absolute left-0 top-6 w-10 h-10 rounded-full border-4 border-[#050505] shadow shadow-brand-primary/50 flex items-center justify-center z-20 ${index === 0 ? 'bg-brand-primary text-white' : 'bg-[#1a1a1a] text-gray-400'
                            }`}>
                            <span className="text-[10px] font-bold">{index + 1}</span>
                        </div>

                        {/* Card */}
                        <div className="ml-12 bg-[#121212] border border-white/10 rounded-2xl overflow-hidden shadow-lg group">
                            {/* Color Bar */}
                            <div className={`h-1.5 w-full ${index === 0 ? 'bg-brand-primary' : 'bg-brand-accent/50'}`}></div>

                            <div className="p-4">
                                <div className="flex justify-between items-start mb-1">
                                    <span className="text-xs font-bold text-gray-400 font-mono tracking-widest uppercase">
                                        {formatClockTime(item.arrivalTime)}
                                    </span>
                                    {item.travelTimeMinutes > 0 && (
                                        <div className="flex items-center gap-1 text-[10px] text-gray-500">
                                            <span>🚗</span>
                                            <span>{item.travelTimeMinutes}m</span>
                                        </div>
                                    )}
                                </div>

                                <h3 className="text-lg font-bold text-white leading-tight mb-2 group-hover:text-brand-accent transition-colors">
                                    {item.name}
                                </h3>

                                <div className="bg-white/5 rounded-lg p-2 mb-2">
                                    <p className="text-xs text-gray-300 italic leading-relaxed">"{item.reason}"</p>
                                </div>

                                <div className="flex justify-between items-center">
                                    {item.matchScore > 0 && (
                                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${item.matchScore > 80 ? 'text-green-400 bg-green-900/30' : 'text-gray-400 bg-white/5'}`}>
                                            {item.matchScore}% Vibe Match
                                        </span>
                                    )}
                                    <button className="text-[10px] uppercase font-bold text-gray-500 hover:text-white transition">Details &gt;</button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                {/* End Marker */}
                <div className="flex items-center gap-4 ml-1 opacity-50">
                    <div className="w-8 h-8 rounded-full bg-[#121212] border-2 border-white/20 flex items-center justify-center z-10">
                        <span className="text-xs">🏁</span>
                    </div>
                    <span className="text-xs text-gray-500 font-mono tracking-widest uppercase">Night Complete</span>
                </div>

            </div>
        </div>
    );
};

export default Itinerary;
