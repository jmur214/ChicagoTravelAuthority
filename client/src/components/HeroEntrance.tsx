import React, { useState } from 'react';

interface HeroEntranceProps {
    onEnter: () => void;
}

const HeroEntrance: React.FC<HeroEntranceProps> = ({ onEnter }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isVisible, setIsVisible] = useState(true);

    const handleEnter = () => {
        setIsOpen(true);
        // Wait for door animation (1.5s) to finish before unmounting
        setTimeout(() => {
            onEnter();
            setIsVisible(false); // remove from DOM
        }, 1500);
    };

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-[9999] pointer-events-none">
            {/* DOOR CONTAINER */}
            <div className={`fixed inset-0 z-[1000] flex pointer-events-none transition-transform duration-[1500ms] ease-in-out ${isOpen ? 'translate-x-full' : 'translate-x-0'}`}>

                {/* THE DOORS: Brushed Metal / Silver CTA Vibe */}
                <div className="relative w-full h-full bg-[#C0C0C0] flex items-center justify-center overflow-hidden shadow-2xl">

                    {/* Brushed Metal Texture Overlay */}
                    <div className="absolute inset-0 opacity-20 pointer-events-none"
                        style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 2px, #000 2px, #000 3px)' }}>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-black/40 pointer-events-none"></div>

                    {/* WINDOW: The "View" of Chicago */}
                    {/* A wide window revealing the skyline */}
                    <div className="absolute top-1/3 left-0 right-0 h-64 bg-black border-y-8 border-[#888] flex items-center justify-center overflow-hidden">
                        <div className="absolute inset-0 bg-cover bg-center opacity-80"
                            style={{
                                backgroundImage: 'url("https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?q=80&w=2613&auto=format&fit=crop")', // Chicago Night Skyline
                                filter: 'blur(2px)' // Slight depth of field
                            }}
                        ></div>
                        {/* Reflection overlay */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent"></div>
                    </div>

                    {/* SAFETY STRIPES: Subtle, modern bottom strip */}
                    <div className="absolute bottom-10 left-0 right-0 h-8 bg-[repeating-linear-gradient(45deg,#D91E18,#D91E18_20px,#F0F0F0_20px,#F0F0F0_40px)] opacity-80 border-y border-black/20"></div>

                    {/* CENTER CONTENT: The "Enter" Button */}
                    <div className="relative z-50 flex flex-col items-center pointer-events-auto">
                        <div className="bg-black/80 backdrop-blur-md p-8 rounded-2xl border border-white/10 shadow-2xl text-center transform transition-transform hover:scale-105">
                            <h1 className="text-4xl font-[900] text-white tracking-tight mb-2 uppercase font-['Outfit']">
                                The Loop
                            </h1>
                            <p className="text-gray-400 text-sm mb-6 tracking-widest uppercase">Chicago Travel Authority</p>

                            <button
                                onClick={handleEnter}
                                className="group relative px-8 py-3 bg-[#00F0FF] text-black font-bold uppercase tracking-widest rounded hover:bg-white transition-colors duration-300 shadow-[0_0_20px_rgba(0,240,255,0.4)]"
                            >
                                <span className="relative z-10 flex items-center gap-2">
                                    Enter City <span className="group-hover:translate-x-1 transition-transform">→</span>
                                </span>
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default HeroEntrance;
