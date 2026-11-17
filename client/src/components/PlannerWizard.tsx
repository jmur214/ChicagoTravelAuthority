import React, { useState } from 'react';
import type { PlanRequestInput } from '@cta/shared';
import { useCategories } from '../hooks/useApiData';
import { visibleCategories } from '../lib/categories';
import { toZonedWallTime, zonedWallTimeToDate } from '../lib/datetime';

interface PlannerWizardProps {
    onSubmit: (criteria: PlanRequestInput) => void;
    onCancel: () => void;
}

const TOTAL_STEPS = 4;

/** Neighborhood "scenes". Sent as `neighborhoods`; the planner doesn't score on them yet. */
const ZONES = [
    { name: 'Trendy Zone (Wicker Park)', desc: 'Hipster bars, vintage shops, and tacos.' },
    { name: 'High Energy (River North)', desc: 'Upscale clubs, bottle service, and chaos.' },
    { name: 'Rooftop Ridge (Loop)', desc: 'Views, tourists, and expensive drinks.' },
    { name: 'Divey Strip (Logan Square)', desc: 'Cheap beer, pinball, and flannel.' },
    { name: 'Hidden Gems (West Loop)', desc: 'Industrial chic and michelin stars.' },
];

const CATEGORY_GRADIENTS = [
    'from-blue-500 to-cyan-400',
    'from-purple-600 to-indigo-500',
    'from-pink-500 to-rose-500',
    'from-yellow-700 to-yellow-600',
    'from-red-600 to-orange-500',
    'from-green-500 to-emerald-400',
    'from-teal-500 to-green-400',
    'from-indigo-600 to-purple-600',
];

const PlannerWizard: React.FC<PlannerWizardProps> = ({ onSubmit, onCancel }) => {
    const [step, setStep] = useState(1);
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
    const [selectedZone, setSelectedZone] = useState<string | null>(null);
    const [energyLevel, setEnergyLevel] = useState(3); // 1 (Chill) to 5 (Chaos)
    // Chicago wall-clock time, regardless of the device's timezone.
    const [startTime, setStartTime] = useState(() => toZonedWallTime(new Date()));
    const [budget, setBudget] = useState(2);

    const { data: allCategories = [] } = useCategories();
    const categories = visibleCategories(allCategories);

    const handleNext = () => setStep(prev => Math.min(prev + 1, TOTAL_STEPS));
    const handleBack = () => setStep(prev => Math.max(prev - 1, 1));

    const toggleCategory = (id: number) =>
        setSelectedCategoryIds(prev => (prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]));

    const handleSubmit = () => {
        onSubmit({
            categoryIds: selectedCategoryIds,
            neighborhoods: selectedZone ? [selectedZone] : [],
            // datetime-local has no timezone: interpret it as Chicago time and send an exact instant.
            startTime: zonedWallTimeToDate(startTime).toISOString(),
            budget,
            energyLevel,
        });
    };

    // --- STEPS RENDER ---

    const renderStep1_Vibes = () => (
        <div className="space-y-6 animate-fadeIn">
            <div className="text-center">
                <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-brand-primary to-brand-accent mb-2">
                    What's the Vibe?
                </h2>
                <p className="text-gray-400">Select as many categories as you like.</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-2">
                {categories.map((cat, index) => (
                    <button
                        key={cat.id}
                        onClick={() => toggleCategory(cat.id)}
                        className={`relative h-24 rounded-2xl overflow-hidden group transition-all duration-300 ${selectedCategoryIds.includes(cat.id) ? 'scale-105 ring-2 ring-white shadow-[0_0_20px_rgba(255,255,255,0.3)]' : 'hover:scale-95 opacity-80'
                            }`}
                    >
                        <div className={`absolute inset-0 bg-gradient-to-br ${CATEGORY_GRADIENTS[index % CATEGORY_GRADIENTS.length]} opacity-80 group-hover:opacity-100 transition`}></div>
                        <div className="absolute inset-0 flex items-center justify-center p-2 text-center">
                            <span className="text-lg font-bold uppercase tracking-widest text-white drop-shadow-md leading-tight">{cat.name}</span>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );

    const renderStep2_Zones = () => (
        <div className="space-y-6 animate-fadeIn">
            <div className="text-center">
                <h2 className="text-3xl font-bold text-white mb-2">Pick your Scene</h2>
                <p className="text-gray-400">Where are we starting tonight?</p>
            </div>

            <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-2">
                {ZONES.map(zone => (
                    <button
                        key={zone.name}
                        onClick={() => setSelectedZone(zone.name)}
                        className={`p-4 rounded-xl border text-left transition-all ${selectedZone === zone.name
                            ? 'bg-brand-primary/20 border-brand-primary shadow-[0_0_15px_rgba(255,59,255,0.3)]'
                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                            }`}
                    >
                        <div className="font-bold text-lg">{zone.name}</div>
                        <div className="text-sm text-gray-400">{zone.desc}</div>
                    </button>
                ))}
            </div>
        </div>
    );

    const renderStep3_Energy = () => (
        <div className="space-y-12 animate-fadeIn py-10">
            <div className="text-center">
                <h2 className="text-3xl font-bold text-white mb-2">Energy Curve</h2>
                <p className="text-gray-400">Set the tempo for the night.</p>
            </div>

            <div className="px-8">
                <input
                    type="range" min="1" max="5" step="1"
                    value={energyLevel}
                    onChange={e => setEnergyLevel(Number(e.target.value))}
                    className="w-full accent-brand-accent h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between mt-4 text-sm font-bold uppercase tracking-widest">
                    <span className={energyLevel === 1 ? 'text-brand-accent' : 'text-gray-600'}>Chill</span>
                    <span className={energyLevel === 3 ? 'text-brand-accent' : 'text-gray-600'}>Buzzing</span>
                    <span className={energyLevel === 5 ? 'text-brand-primary neon-text-glow' : 'text-gray-600'}>Chaos</span>
                </div>
            </div>

            {/* Visualizer (Simple SVG wave that changes amplitude based on energy) */}
            <div className="h-24 flex items-center justify-center opacity-50">
                <svg viewBox="0 0 100 20" className="w-full h-full stroke-brand-accent fill-none stroke-2">
                    <path d={`M0 10 Q 25 ${10 - energyLevel * 2} 50 10 T 100 10`} />
                </svg>
            </div>
        </div>
    );

    const renderStep4_Logistics = () => (
        <div className="space-y-6 animate-fadeIn">
            <div className="text-center">
                <h2 className="text-3xl font-bold text-white mb-2">The Details</h2>
            </div>

            <div className="bg-white/5 p-6 rounded-2xl border border-white/10 space-y-6">
                <div>
                    <label className="block text-xs uppercase text-gray-500 mb-2">Start Time (Chicago)</label>
                    <input
                        type="datetime-local"
                        value={startTime}
                        onChange={e => setStartTime(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 p-4 rounded-xl text-white focus:border-brand-primary outline-none"
                    />
                </div>

                <div>
                    <label className="block text-xs uppercase text-gray-500 mb-2">Budget Cap</label>
                    <div className="flex gap-2">
                        {[1, 2, 3, 4].map(b => (
                            <button
                                key={b}
                                onClick={() => setBudget(b)}
                                className={`flex-1 py-3 rounded-xl border font-bold transition ${budget === b ? 'bg-white text-black border-white' : 'bg-transparent border-white/20 text-gray-500 hover:text-white'
                                    }`}
                            >
                                {'$'.repeat(b)}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="h-full flex flex-col relative p-6">

            {/* Header / Nav */}
            <div className="flex justify-between items-center mb-8">
                <div className="flex gap-2">
                    {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map(i => (
                        <div key={i} className={`h-1.5 w-8 rounded-full transition-colors ${step >= i ? 'bg-white' : 'bg-white/10'}`}></div>
                    ))}
                </div>
                <button onClick={onCancel} className="text-xs uppercase tracking-widest text-gray-500 hover:text-white transition">Close</button>
            </div>

            {/* Content Body */}
            <div className="flex-1 flex flex-col justify-center max-w-2xl mx-auto w-full">
                {step === 1 && renderStep1_Vibes()}
                {step === 2 && renderStep2_Zones()}
                {step === 3 && renderStep3_Energy()}
                {step === 4 && renderStep4_Logistics()}
            </div>

            {/* Footer Actions */}
            <div className="flex justify-between items-center mt-8 pt-6 border-t border-white/5">
                <button
                    onClick={handleBack}
                    className={`text-gray-400 hover:text-white transition px-4 py-2 ${step === 1 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                >
                    Back
                </button>

                <button
                    onClick={step === TOTAL_STEPS ? handleSubmit : handleNext}
                    className="bg-brand-primary text-white px-8 py-3 rounded-xl font-bold shadow-[0_0_20px_rgba(255,59,255,0.4)] hover:shadow-[0_0_30px_rgba(255,59,255,0.6)] hover:scale-105 transition-all text-sm uppercase tracking-widest"
                >
                    {step === TOTAL_STEPS ? 'Generate Plan' : 'Next Step'}
                </button>
            </div>
        </div>
    );
};

export default PlannerWizard;
