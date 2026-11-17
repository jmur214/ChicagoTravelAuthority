import React from 'react';
import { formatHHMM, getOpenStatus, type Location, type OpenStatus } from '@cta/shared';

const openStatusLabel = (status: OpenStatus): { label: string; open: boolean } => {
    switch (status.state) {
        case 'open':
            return { label: `Open until ${formatHHMM(status.closesAt)}`, open: true };
        case 'closed':
            return { label: status.opensAt ? `Closed · opens ${formatHHMM(status.opensAt)}` : 'Closed today', open: false };
        default:
            return { label: 'Hours unknown', open: false };
    }
};

interface LocationDetailsProps {
    location: Location;
    onClose: () => void;
}

const LocationDetails: React.FC<LocationDetailsProps> = ({ location, onClose }) => {
    const imageUrl = location.metadata?.imageUrl;
    const hours = location.openHours ? openStatusLabel(getOpenStatus(location.openHours, new Date())) : null;

    return (
        <div className="h-full flex flex-col bg-[#050505]/95 backdrop-blur-3xl border-l border-white/5 relative shadow-[0_0_50px_rgba(0,0,0,0.8)] animate-slideInRight">

            {/* Cinematic Gradient Overlay */}
            <div className="absolute inset-0 z-0 bg-gradient-to-b from-brand-primary/5 via-transparent to-transparent opacity-20 pointer-events-none"></div>

            {/* Floating Close Button */}
            <button
                onClick={onClose}
                className="absolute top-6 right-6 z-50 w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 text-gray-300 hover:text-white flex items-center justify-center transition-all duration-300 group"
            >
                <span className="group-hover:rotate-90 transition-transform duration-300">✕</span>
            </button>

            {/* Immersive Hero Header */}
            <div className="relative h-[40vh] shrink-0 w-full overflow-hidden group">
                {/* Image Parallax/Zoom Effect */}
                {imageUrl ? (
                    <div className="w-full h-full bg-cover bg-center transition-transform duration-[20s] ease-linear transform scale-100 group-hover:scale-110"
                        style={{ backgroundImage: `url(${JSON.stringify(imageUrl)})` }}></div>
                ) : (
                    <div className="w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-800 via-[#050505] to-[#000] flex items-center justify-center">
                        <h1 className="text-9xl font-black text-white/5 tracking-tighter select-none">CHI</h1>
                    </div>
                )}

                {/* Gradient Fades */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/60 to-transparent"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-[#050505]/80 via-transparent to-transparent"></div>

                {/* Title & Badge Block */}
                <div className="absolute bottom-6 left-8 right-8 z-10">
                    {/* Neon Vibe Badge - Only if Staff Verified */}
                    {location.verifiedVibe && (
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand-primary/30 bg-brand-primary/10 backdrop-blur-md mb-4 shadow-[0_0_15px_rgba(255,59,255,0.2)] animate-pulse">
                            <div className="w-1.5 h-1.5 rounded-full bg-brand-primary"></div>
                            <span className="text-[10px] font-bold text-brand-primary uppercase tracking-[0.2em]">Verified Vibe</span>
                        </div>
                    )}

                    <h1 className="text-4xl md:text-5xl font-black text-white leading-[0.9] mb-4 tracking-tighter drop-shadow-2xl">
                        {location.name}
                    </h1>

                    {/* Tag Cloud */}
                    <div className="flex flex-wrap gap-2">
                        {location.tags.map(t => (
                            <span key={t.tag.id} className="text-[10px] font-medium px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-gray-300 border border-white/5 transition-colors cursor-default">
                                {t.tag.name}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content Scrollable Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-6 space-y-10 relative z-10">

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-3 gap-4 border-b border-white/5 pb-8">
                    <div className="space-y-1">
                        <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Expect to Spend</span>
                        <div className="text-xl font-medium text-white flex items-baseline gap-1">
                            {location.avgCost ? (
                                <>
                                    <span className="text-brand-accent">{'$'.repeat(location.avgCost)}</span>
                                    <span className="text-gray-600 text-sm">{'$'.repeat(4 - location.avgCost)}</span>
                                </>
                            ) : (
                                <span className="text-gray-600">—</span>
                            )}
                        </div>
                    </div>
                    <div className="space-y-1">
                        <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Vibe Score</span>
                        <div className="text-xl font-medium text-white">
                            {location.rating != null ? location.rating.toFixed(1) : '—'} <span className="text-xs text-gray-600">/ 5.0</span>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Avg Stay</span>
                        <div className="text-xl font-medium text-white">{location.avgStayMinutes}<span className="text-sm text-gray-600">m</span></div>
                    </div>
                </div>

                {/* Narrative Description */}
                <div className="space-y-3">
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                        <span className="w-4 h-[1px] bg-brand-primary"></span>
                        The Experience
                    </h3>
                    <p className="text-lg text-gray-300 font-light leading-relaxed">
                        {location.description || "An essential Chicago destination known for its unique atmosphere and curated energy. Perfect for those looking to explore the city's hidden depth."}
                    </p>
                </div>

                {/* Interactive Elements / Map Preview (Placeholder) */}
                <div className="space-y-3">
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                        <span className="w-4 h-[1px] bg-brand-accent"></span>
                        Access Info
                    </h3>

                    {hours && (
                        <div className="bg-[#0A0A0A] border border-white/5 rounded-xl p-4">
                            <div className="grid grid-cols-2 gap-y-2 text-sm">
                                <div className="text-gray-500">Right now</div>
                                <div className={`text-right font-bold ${hours.open ? 'text-brand-accent' : 'text-gray-400'}`}>{hours.label}</div>
                            </div>
                        </div>
                    )}
                    {location.address && <p className="text-sm text-gray-400">{location.address}</p>}
                </div>

                {/* "Insider Tip" Box */}
                {location.eventsInfo && (
                    <div className="relative overflow-hidden rounded-xl p-6 group cursor-default">
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-900/40 to-blue-900/40 border border-white/10 group-hover:border-white/20 transition-colors"></div>
                        <div className="absolute top-0 right-0 p-2 opacity-20">
                            <span className="text-4xl">💡</span>
                        </div>
                        <div className="relative z-10">
                            <div className="text-[10px] font-black text-brand-primary uppercase tracking-[0.2em] mb-2">Insider Tip</div>
                            <p className="text-gray-200 italic">"{location.eventsInfo}"</p>
                        </div>
                    </div>
                )}

                {/* Spacer for FAB */}
                <div className="h-20"></div>
            </div>

            {/* Floating Action Bar (Bottom) */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#050505] via-[#050505] to-transparent z-40 flex gap-4">
                {/* Link Button */}
                {location.website && (
                    <a href={location.website} target="_blank" rel="noreferrer"
                        className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-white/20 transition-all text-white group"
                        title="Visit Website"
                    >
                        <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    </a>
                )}

                {/* Primary Action */}
                <button className="flex-1 bg-white text-black rounded-full font-bold text-sm uppercase tracking-widest hover:bg-gray-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.3)] flex items-center justify-center gap-2 group">
                    <span>Add to Plan</span>
                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                </button>
            </div>

        </div>
    );
};

export default LocationDetails;
