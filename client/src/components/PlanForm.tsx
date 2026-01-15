import React, { useState } from 'react';

interface PlanFormProps {
    onSubmit: (criteria: any) => void;
    onCancel: () => void;
}

const VIBES = ['Cozy', 'Cocktails', 'Dinner', 'Nightlife', 'Coffee', 'Activity'];

const PlanForm: React.FC<PlanFormProps> = ({ onSubmit, onCancel }) => {
    const [vibes, setVibes] = useState<string[]>([]);
    const [duration, setDuration] = useState(4);

    const toggleVibe = (v: string) => {
        if (vibes.includes(v)) setVibes(vibes.filter(vite => vite !== v));
        else setVibes([...vibes, v]);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({
            startTime: new Date().toISOString(), // Default now
            durationHours: duration,
            vibes
        });
    };

    return (
        <div className="flex flex-col h-full">
            <h2 className="text-xl font-bold mb-4 text-white">Plan Your Night</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-6 flex-1">
                <div>
                    <label className="block text-xs font-medium text-gray-400 mb-3 uppercase tracking-wider">Vibe</label>
                    <div className="flex flex-wrap gap-2">
                        {VIBES.map(v => (
                            <button
                                type="button"
                                key={v}
                                onClick={() => toggleVibe(v)}
                                className={`px-4 py-2 rounded-xl text-sm font-medium transition border ${vibes.includes(v)
                                        ? 'bg-brand-accent text-white border-brand-accent shadow-lg shadow-brand-accent/25'
                                        : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-white'
                                    }`}
                            >
                                {v}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-400 mb-3 uppercase tracking-wider">Duration: <span className="text-white">{duration} Hours</span></label>
                    <input
                        type="range"
                        min="2" max="10"
                        value={duration}
                        onChange={(e) => setDuration(Number(e.target.value))}
                        className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-brand-primary"
                    />
                    <div className="flex justify-between text-xs text-gray-600 mt-2">
                        <span>Quick</span>
                        <span>All Night</span>
                    </div>
                </div>

                <div className="mt-auto flex gap-3 pt-4 border-t border-white/10">
                    <button type="button" onClick={onCancel} className="flex-1 py-3 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition font-medium">Cancel</button>
                    <button type="submit" className="flex-1 py-3 bg-brand-primary text-white rounded-xl font-semibold shadow-lg shadow-brand-primary/30 hover:bg-brand-primary/90 transition transform active:scale-95">Generate</button>
                </div>
            </form>
        </div>
    );
};

export default PlanForm;
