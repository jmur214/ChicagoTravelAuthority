import React, { useState } from 'react';
import {
    CHICAGO_CENTER,
    DEFAULT_TRANSPORT_MODE,
    distanceKm,
    NEIGHBORHOODS,
    type NeighborhoodId,
    type PlanRequestInput,
    type TransportMode,
} from '@cta/shared';
import { useCategories } from '../hooks/useApiData';
import { visibleCategories } from '../lib/categories';
import { toZonedWallTime, zonedWallTimeToDate } from '../lib/datetime';
import { TRANSPORT_OPTIONS } from '../lib/transport';

interface PlannerWizardProps {
    onSubmit: (criteria: PlanRequestInput) => void;
    onCancel: () => void;
}

const TOTAL_STEPS = 4;
const DURATIONS = [2, 3, 4, 6];
const ENERGY_LABELS = ['Chill', 'Easy', 'Buzzing', 'Lively', 'Chaos'];
/** "Near me" only makes sense in town. */
const MAX_KM_FROM_DOWNTOWN = 40;

type StartChoice =
    | { kind: 'anywhere' }
    | { kind: 'neighborhood'; id: NeighborhoodId }
    | { kind: 'here'; lat: number; lng: number };

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

const optionClass = (selected: boolean) =>
    `p-4 rounded-xl border text-left transition-all ${selected
        ? 'bg-brand-primary/20 border-brand-primary shadow-[0_0_15px_rgba(255,59,255,0.3)]'
        : 'bg-white/5 border-white/10 hover:bg-white/10'}`;

const chipClass = (selected: boolean) =>
    `flex-1 py-3 rounded-xl border font-bold transition ${selected ? 'bg-white text-black border-white' : 'bg-transparent border-white/20 text-gray-500 hover:text-white'}`;

const PlannerWizard: React.FC<PlannerWizardProps> = ({ onSubmit, onCancel }) => {
    const [step, setStep] = useState(1);
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
    const [start, setStart] = useState<StartChoice>({ kind: 'anywhere' });
    const [locating, setLocating] = useState(false);
    const [locateError, setLocateError] = useState<string | null>(null);
    const [energyLevel, setEnergyLevel] = useState(3);
    // Chicago wall-clock time, regardless of the device's timezone.
    const [startTime, setStartTime] = useState(() => toZonedWallTime(new Date()));
    const [budget, setBudget] = useState(2);
    const [transportMode, setTransportMode] = useState<TransportMode>(DEFAULT_TRANSPORT_MODE);
    const [durationHours, setDurationHours] = useState(4);

    const { data: allCategories = [] } = useCategories();
    const categories = visibleCategories(allCategories);

    const handleNext = () => setStep(prev => Math.min(prev + 1, TOTAL_STEPS));
    const handleBack = () => setStep(prev => Math.max(prev - 1, 1));

    const toggleCategory = (id: number) =>
        setSelectedCategoryIds(prev => (prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]));

    const locateMe = () => {
        if (!navigator.geolocation) {
            setLocateError("This browser can't share your location.");
            return;
        }
        setLocating(true);
        setLocateError(null);
        navigator.geolocation.getCurrentPosition(
            ({ coords }) => {
                setLocating(false);
                if (distanceKm(coords.latitude, coords.longitude, CHICAGO_CENTER.lat, CHICAGO_CENTER.lng) > MAX_KM_FROM_DOWNTOWN) {
                    setLocateError("You're not in Chicago right now — pick a neighborhood instead.");
                    return;
                }
                setStart({ kind: 'here', lat: coords.latitude, lng: coords.longitude });
            },
            () => {
                setLocating(false);
                setLocateError('Location permission was denied or unavailable.');
            },
            { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
        );
    };

    const handleSubmit = () => {
        onSubmit({
            categoryIds: selectedCategoryIds,
            ...(start.kind === 'neighborhood' && { neighborhood: start.id }),
            ...(start.kind === 'here' && { startLocation: { lat: start.lat, lng: start.lng } }),
            // datetime-local has no timezone: interpret it as Chicago time and send an exact instant.
            startTime: zonedWallTimeToDate(startTime).toISOString(),
            budget,
            energyLevel,
            transportMode,
            durationHours,
        });
    };

    const renderStep1_Vibes = () => (
        <div className="space-y-6 animate-fadeIn">
            <div className="text-center">
                <h2 className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-brand-primary to-brand-accent mb-2">
                    What's the Vibe?
                </h2>
                <p className="text-gray-400">Select as many categories as you like.</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 p-2">
                {categories.map((cat, index) => (
                    <button
                        key={cat.id}
                        onClick={() => toggleCategory(cat.id)}
                        aria-pressed={selectedCategoryIds.includes(cat.id)}
                        className={`relative h-20 sm:h-24 rounded-2xl overflow-hidden group transition-all duration-300 ${selectedCategoryIds.includes(cat.id) ? 'scale-105 ring-2 ring-white shadow-[0_0_20px_rgba(255,255,255,0.3)]' : 'hover:scale-95 opacity-80'}`}
                    >
                        <div className={`absolute inset-0 bg-gradient-to-br ${CATEGORY_GRADIENTS[index % CATEGORY_GRADIENTS.length]} opacity-80 group-hover:opacity-100 transition`}></div>
                        <div className="absolute inset-0 flex items-center justify-center p-2 text-center">
                            <span className="text-sm sm:text-lg font-bold uppercase tracking-widest text-white drop-shadow-md leading-tight break-words">{cat.name}</span>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );

    const renderStep2_Start = () => (
        <div className="space-y-6 animate-fadeIn">
            <div className="text-center">
                <h2 className="text-3xl font-bold text-white mb-2">Pick your Scene</h2>
                <p className="text-gray-400">Where are we starting tonight?</p>
            </div>

            <div className="flex flex-col gap-3">
                <button onClick={locateMe} disabled={locating} className={optionClass(start.kind === 'here')}>
                    <div className="font-bold text-lg">📍 {locating ? 'Finding you…' : 'Start near me'}</div>
                    <div className="text-sm text-gray-400">Use your current location.</div>
                </button>
                {locateError && <p className="text-sm text-yellow-400 px-1">{locateError}</p>}

                {NEIGHBORHOODS.map(n => (
                    <button
                        key={n.id}
                        onClick={() => setStart({ kind: 'neighborhood', id: n.id })}
                        className={optionClass(start.kind === 'neighborhood' && start.id === n.id)}
                    >
                        <div className="font-bold text-lg">{n.scene} <span className="text-gray-400 font-normal">({n.name})</span></div>
                        <div className="text-sm text-gray-400">{n.description}</div>
                    </button>
                ))}

                <button onClick={() => setStart({ kind: 'anywhere' })} className={optionClass(start.kind === 'anywhere')}>
                    <div className="font-bold text-lg">Anywhere downtown</div>
                    <div className="text-sm text-gray-400">Start from the Loop and go wherever's best.</div>
                </button>
            </div>
        </div>
    );

    const renderStep3_Energy = () => (
        <div className="space-y-10 animate-fadeIn py-6">
            <div className="text-center">
                <h2 className="text-3xl font-bold text-white mb-2">Energy Curve</h2>
                <p className="text-gray-400">Set the tempo — we'll ease in with the first stop.</p>
            </div>

            <div className="px-4 sm:px-8">
                <input
                    type="range" min="1" max="5" step="1"
                    aria-label="Energy level"
                    value={energyLevel}
                    onChange={e => setEnergyLevel(Number(e.target.value))}
                    className="w-full accent-brand-accent h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between mt-4 text-sm font-bold uppercase tracking-widest">
                    <span className={energyLevel === 1 ? 'text-brand-accent' : 'text-gray-600'}>Chill</span>
                    <span className={energyLevel === 3 ? 'text-brand-accent' : 'text-gray-600'}>Buzzing</span>
                    <span className={energyLevel === 5 ? 'text-brand-primary neon-text-glow' : 'text-gray-600'}>Chaos</span>
                </div>
                <p className="text-center mt-6 text-white font-bold uppercase tracking-widest">{ENERGY_LABELS[energyLevel - 1]}</p>
            </div>

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

            <div className="bg-white/5 p-4 sm:p-6 rounded-2xl border border-white/10 space-y-6">
                <div>
                    <label className="block text-xs uppercase text-gray-500 mb-2" htmlFor="plan-start">Start Time (Chicago)</label>
                    <input
                        id="plan-start"
                        type="datetime-local"
                        value={startTime}
                        onChange={e => setStartTime(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 p-4 rounded-xl text-white focus:border-brand-primary outline-none"
                    />
                </div>

                <div>
                    <span className="block text-xs uppercase text-gray-500 mb-2">How long?</span>
                    <div className="flex gap-2">
                        {DURATIONS.map(h => (
                            <button key={h} onClick={() => setDurationHours(h)} aria-pressed={durationHours === h} className={chipClass(durationHours === h)}>
                                {h}h
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <span className="block text-xs uppercase text-gray-500 mb-2">Getting around</span>
                    <div className="flex gap-2">
                        {TRANSPORT_OPTIONS.map(o => (
                            <button key={o.mode} onClick={() => setTransportMode(o.mode)} aria-pressed={transportMode === o.mode} className={chipClass(transportMode === o.mode)}>
                                {o.icon} <span className="text-sm">{o.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <span className="block text-xs uppercase text-gray-500 mb-2">Budget Cap</span>
                    <div className="flex gap-2">
                        {[1, 2, 3, 4].map(b => (
                            <button key={b} onClick={() => setBudget(b)} aria-pressed={budget === b} className={chipClass(budget === b)}>
                                {'$'.repeat(b)}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="h-full flex flex-col relative p-4 sm:p-6 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
            {/* Header */}
            <div className="flex justify-between items-center mb-4 sm:mb-8 shrink-0">
                <div className="flex gap-2">
                    {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map(i => (
                        <div key={i} className={`h-1.5 w-8 rounded-full transition-colors ${step >= i ? 'bg-white' : 'bg-white/10'}`}></div>
                    ))}
                </div>
                <button onClick={onCancel} className="text-xs uppercase tracking-widest text-gray-500 hover:text-white transition p-2">Close</button>
            </div>

            {/* Body: scrolls on small screens; centered when it fits */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                <div className="min-h-full flex flex-col justify-center max-w-2xl mx-auto w-full">
                    {step === 1 && renderStep1_Vibes()}
                    {step === 2 && renderStep2_Start()}
                    {step === 3 && renderStep3_Energy()}
                    {step === 4 && renderStep4_Logistics()}
                </div>
            </div>

            {/* Footer: always visible */}
            <div className="flex justify-between items-center mt-4 sm:mt-8 pt-4 sm:pt-6 border-t border-white/5 shrink-0">
                <button
                    onClick={handleBack}
                    className={`text-gray-400 hover:text-white transition px-4 py-2 ${step === 1 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                >
                    Back
                </button>
                <button
                    onClick={step === TOTAL_STEPS ? handleSubmit : handleNext}
                    className="bg-brand-primary text-white px-6 sm:px-8 py-3 rounded-xl font-bold shadow-[0_0_20px_rgba(255,59,255,0.4)] hover:shadow-[0_0_30px_rgba(255,59,255,0.6)] hover:scale-105 transition-all text-sm uppercase tracking-widest"
                >
                    {step === TOTAL_STEPS ? 'Generate Plan' : 'Next Step'}
                </button>
            </div>
        </div>
    );
};

export default PlannerWizard;
