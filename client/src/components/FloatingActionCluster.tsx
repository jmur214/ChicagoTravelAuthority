import React, { useState } from 'react';

interface FACProps {
    onPlan: () => void;
    onExplore: () => void;
    onToggleFilters: () => void;
    onAdmin: () => void;
}

const FloatingActionCluster: React.FC<FACProps> = ({ onPlan, onExplore, onToggleFilters, onAdmin }) => {
    const [isOpen, setIsOpen] = useState(false);

    const toggleOpen = () => setIsOpen(!isOpen);

    return (
        <div className="absolute bottom-8 right-6 z-[1000] flex flex-col items-end gap-4 pointer-events-auto">

            {/* Expansion Menu */}
            <div className={`flex flex-col gap-3 transition-all duration-300 origin-bottom-right ${isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-50 opacity-0 translate-y-10 pointer-events-none'}`}>

                {/* Plan My Night */}
                <button
                    onClick={() => { onPlan(); setIsOpen(false); }}
                    className="flex items-center gap-3 bg-white text-black pl-4 pr-2 py-2 rounded-full shadow-xl hover:bg-gray-200 transition group"
                >
                    <span className="font-bold text-sm">Plan My Night</span>
                    <div className="w-8 h-8 bg-black rounded-full text-white flex items-center justify-center">
                        ✨
                    </div>
                </button>

                {/* Explore Vibes (Reset) */}
                <button
                    onClick={() => { onExplore(); setIsOpen(false); }}
                    className="flex items-center gap-3 bg-[rgba(10,10,10,0.9)] text-white border border-white/20 pl-4 pr-2 py-2 rounded-full shadow-xl hover:bg-black transition backdrop-blur-md"
                >
                    <span className="font-medium text-sm">Explore Vibes</span>
                    <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center">
                        🗺️
                    </div>
                </button>

                {/* Filters */}
                <button
                    onClick={() => { onToggleFilters(); setIsOpen(false); }}
                    className="flex items-center gap-3 bg-[rgba(10,10,10,0.9)] text-white border border-white/20 pl-4 pr-2 py-2 rounded-full shadow-xl hover:bg-black transition backdrop-blur-md"
                >
                    <span className="font-medium text-sm">Filters</span>
                    <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center">
                        🔍
                    </div>
                </button>

                {/* Admin Data */}
                <button
                    onClick={() => { onAdmin(); setIsOpen(false); }}
                    className="flex items-center gap-3 bg-red-900/80 text-white border border-red-500/30 pl-4 pr-2 py-2 rounded-full shadow-xl hover:bg-red-800 transition backdrop-blur-md"
                >
                    <span className="font-medium text-sm">Manage Data</span>
                    <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-xs">
                        ⚙️
                    </div>
                </button>
            </div>

            {/* Main Toggle Button (The "Orb") */}
            <button
                onClick={toggleOpen}
                className={`w-16 h-16 rounded-full shadow-2xl flex items-center justify-center text-3xl transition-all duration-300 relative group overflow-hidden ${isOpen ? 'bg-white text-black rotate-45' : 'bg-brand-primary text-white hover:scale-110'
                    }`}
            >
                {/* Pulse Effect when closed */}
                {!isOpen && <div className="absolute inset-0 bg-brand-primary rounded-full animate-ping opacity-30"></div>}
                <div className="relative z-10 flex items-center justify-center">
                    {isOpen ? '+' : '◎'}
                </div>
            </button>
        </div>
    );
};

export default FloatingActionCluster;
