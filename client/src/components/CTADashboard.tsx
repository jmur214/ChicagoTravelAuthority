import React from 'react';
import SuggestionCarousel from './SuggestionCarousel';
import type { Location } from '@cta/shared';

interface CTADashboardProps {
    onPlan: () => void;
    onExploreMap: () => void;
    onManage: () => void;
    locations: Location[];
    onLocationSelect: (id: number) => void;
}

const CTADashboard: React.FC<CTADashboardProps> = ({
    onPlan,
    onExploreMap,
    onManage,
    locations,
    onLocationSelect
}) => {

    // Derived date for "Tonight"
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    return (
        <div className="absolute inset-0 z-[50] bg-[#050505] text-white flex flex-col overflow-hidden animate-fadeIn">

            {/* 3.1 HEADER ROW */}
            <header className="h-14 px-6 flex items-center justify-between border-b border-white/10 bg-[#0a0a0a]">
                <div className="w-10">
                    {/* Placeholder for future profile icon */}
                </div>
                <h1 className="text-sm font-bold tracking-[0.2em] text-gray-500 uppercase">Chicago Travel Authority</h1>
                <button
                    onClick={onManage}
                    className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white hover:rotate-90 transition-all"
                    title="Manage Data"
                >
                    ⚙️
                </button>
            </header>

            {/* MAIN CONTENT GRID */}
            <div className="flex-1 p-6 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto custom-scrollbar">

                {/* LEFT COLUMN */}
                <div className="flex flex-col gap-6">

                    {/* 3.2 HERO MODULE — "PLAN MY NIGHT" */}
                    <div
                        onClick={onPlan}
                        className="
                            flex-1 min-h-[300px] bg-gradient-to-br from-brand-primary/20 to-brand-accent/10 
                            border-l-4 border-brand-primary border-t border-r border-b border-white/10
                            p-8 flex flex-col justify-end cursor-pointer group hover:bg-brand-primary/10 transition-all relative overflow-hidden
                        "
                    >
                        {/* Background Deco */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/20 blur-[100px] rounded-full group-hover:bg-brand-primary/30 transition-all" />

                        <div className="relative z-10">
                            <h2 className="text-5xl font-black italic uppercase tracking-tighter mb-2 group-hover:translate-x-2 transition-transform">
                                Plan<br />My Night
                            </h2>
                            <p className="text-gray-300 font-medium tracking-wide flex items-center gap-2">
                                <span className="w-2 h-2 bg-brand-primary rounded-full animate-pulse" />
                                Your curated night starts here.
                            </p>
                        </div>

                        {/* CTA Arrow */}
                        <div className="absolute top-8 right-8 p-3 border border-white/20 rounded-full group-hover:bg-white group-hover:text-black transition-all">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                        </div>
                    </div>

                    {/* 3.4 THIRD MODULE — "NIGHT SUMMARY" */}
                    <div className="h-[200px] bg-[#111] border border-white/10 p-6 flex flex-col justify-between group hover:border-white/20 transition-all relative">
                        {/* L-Train Stripe Decor */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#e33d3d] via-[#10a1cd] to-[#fdb913] opacity-50" />

                        <div>
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Tonight in Chicago</h3>
                            <p className="text-lg font-medium text-gray-300">{today}</p>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                                <span className="text-brand-accent">●</span> 14 Rooftops open late
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                                <span className="text-green-500">●</span> Wicker Park is trending
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                                <span className="text-blue-500">●</span> Jazz Festival @ Millennium
                            </div>
                        </div>
                    </div>

                </div>

                {/* RIGHT COLUMN */}
                <div className="flex flex-col gap-6">

                    {/* 3.3 RIGHT-SIDE MODULE — MINIMAP PANEL */}
                    <div className="relative flex-1 min-h-[400px] border border-white/10 bg-[#0a0a0a] overflow-hidden group">

                        {/* Static Map Image / Placeholder */}
                        {/* Ideally we render a static version of the map here. 
                            For now, we can use a screenshot or a very simplified MapComponent if performance allows. 
                            Let's use a blurred placeholder div with a "Portal" look. 
                        */}
                        <div className="absolute inset-0 bg-[#121212] flex items-center justify-center opacity-60 group-hover:opacity-40 transition-all duration-700 group-hover:scale-105">
                            {/* Abstract Map Lines */}
                            <div className="absolute inset-0 opacity-20"
                                style={{ backgroundImage: 'radial-gradient(circle, #333 1px, transparent 1px)', backgroundSize: '20px 20px' }}
                            />
                            <div className="w-full h-1/2 bg-gradient-to-b from-transparent via-[#00a1de]/10 to-transparent transform -skew-y-12 blur-xl" />
                            <div className="absolute w-full h-full border-[20px] border-[#0a0a0a]" />
                        </div>

                        {/* Overlay Content */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <h3 className="text-3xl font-black uppercase tracking-widest text-white/20 group-hover:text-white/80 transition-all transform group-hover:scale-110 duration-500">
                                Explore Map
                            </h3>
                            <div className="mt-4 px-6 py-2 border border-white/30 rounded-full text-xs font-bold uppercase tracking-widest text-white/60 group-hover:border-white group-hover:text-white group-hover:bg-white/10 transition-all">
                                Tap to Enter
                            </div>
                        </div>

                        {/* Click Handler */}
                        <button
                            onClick={onExploreMap}
                            className="absolute inset-0 w-full h-full z-10 cursor-pointer focus:outline-none"
                            aria-label="Enter Map"
                        />
                    </div>
                </div>
            </div>

            {/* 3.5 CAROUSELS AREA */}
            <div className="h-[280px] bg-[#080808] border-t border-white/10 p-6 flex flex-col justify-center relative">

                <div className="flex justify-between items-end mb-4">
                    <h3 className="text-xl font-bold text-white">Tonight's Picks</h3>
                    <button onClick={onExploreMap} className="text-xs text-brand-primary font-bold uppercase hover:underline">View All</button>
                </div>

                {/* Re-using SuggestionCarousel logic but constrained */}
                <div className="relative -mx-6 h-48">
                    <SuggestionCarousel locations={locations} onSelect={onLocationSelect} />
                </div>

            </div>

        </div>
    );
};

export default CTADashboard;
