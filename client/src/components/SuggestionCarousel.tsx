import React, { useRef } from 'react';
import type { Location } from '../api/client';

interface SuggestionCarouselProps {
    locations: Location[];
    onSelect: (id: number) => void;
}

const SuggestionCarousel: React.FC<SuggestionCarouselProps> = ({ locations, onSelect }) => {
    // Show random sample for "Tonight's Picks"
    const suggestions = locations.slice(0, 6);
    const scrollRef = useRef<HTMLDivElement>(null);

    return (
        <div className="absolute bottom-6 left-0 right-24 z-[900] pointer-events-none">

            {/* Header */}


            {/* Scroll Container */}
            <div
                ref={scrollRef}
                className="flex gap-4 overflow-x-auto pl-6 pb-4 scrollbar-hide pointer-events-auto snap-x snap-mandatory pr-6"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {suggestions.map(loc => (
                    <div
                        key={loc.id}
                        onClick={() => onSelect(loc.id)}
                        className="glass-card min-w-[260px] max-w-[260px] h-[140px] rounded-xl p-4 flex flex-col justify-end relative overflow-hidden group cursor-pointer snap-start hover:-translate-y-1 transition-transform"
                    >
                        {/* Background Image (If metadata exists, else gradient) */}
                        {/* Note: Safe cast for demo */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent z-10"></div>
                        {(loc.metadata as any)?.imageUrl ? (
                            <img src={(loc.metadata as any).imageUrl} className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-80 transition duration-500" alt={loc.name} />
                        ) : (
                            <div className={`absolute inset-0 bg-gradient-to-br from-gray-800 to-black opacity-60 group-hover:opacity-80 transition duration-500`}></div>
                        )}

                        <div className="relative z-20">
                            {/* Tags */}
                            <div className="flex gap-1 mb-1">
                                {loc.tags?.slice(0, 2).map(t => (
                                    <span key={t.tag.id} className="text-[10px] px-1.5 py-0.5 bg-white/20 backdrop-blur-md rounded text-white border border-white/10">
                                        {t.tag.name}
                                    </span>
                                ))}
                            </div>
                            <h4 className="font-bold text-lg leading-tight text-white group-hover:text-brand-accent transition">{loc.name}</h4>
                            <p className="text-xs text-gray-300 truncate mt-0.5">{loc.description || 'Authentic Chicago vibe.'}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SuggestionCarousel;
