import React from 'react';
import { DAY_KEYS, DEFAULT_DAY_HOURS, type DayHours, type DayKey, type OpenHours } from '@cta/shared';

interface OpenHoursEditorProps {
    value: OpenHours | null;
    onChange: (hours: OpenHours) => void;
}

const OpenHoursEditor: React.FC<OpenHoursEditorProps> = ({ value, onChange }) => {
    const dayHours = (day: DayKey): DayHours => value?.[day] ?? DEFAULT_DAY_HOURS;
    const setDay = (day: DayKey, patch: Partial<DayHours>) => onChange({ ...value, [day]: { ...dayHours(day), ...patch } });

    const copyMondayToAll = () => {
        const monday = value?.mon ?? { ...DEFAULT_DAY_HOURS, isOpen: true };
        onChange(Object.fromEntries(DAY_KEYS.map(d => [d, { ...monday }])) as OpenHours);
    };

    return (
        <div className="bg-black/20 rounded-lg p-4 border border-white/10 space-y-3">
            {DAY_KEYS.map(day => {
                const hours = dayHours(day);
                return (
                    <div key={day} className="flex items-center gap-4">
                        <div className="w-12 text-xs font-bold uppercase text-gray-400">{day}</div>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={hours.isOpen}
                                onChange={e => setDay(day, { isOpen: e.target.checked })}
                                className="rounded border-white/20 bg-transparent text-brand-primary focus:ring-brand-primary"
                            />
                            <span className="text-xs text-gray-500">{hours.isOpen ? 'Open' : 'Closed'}</span>
                        </label>

                        {hours.isOpen && (
                            <div className="flex items-center gap-2">
                                <input
                                    type="time"
                                    aria-label={`${day} opens`}
                                    value={hours.open}
                                    onChange={e => setDay(day, { open: e.target.value })}
                                    className="bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white"
                                />
                                <span className="text-gray-600">-</span>
                                <input
                                    type="time"
                                    aria-label={`${day} closes`}
                                    value={hours.close}
                                    onChange={e => setDay(day, { close: e.target.value })}
                                    className="bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white"
                                />
                            </div>
                        )}
                    </div>
                );
            })}

            <div className="pt-2 border-t border-white/5 flex gap-2 items-center">
                <button type="button" onClick={copyMondayToAll} className="text-xs text-brand-accent hover:text-white transition">
                    Copy Monday to All Days
                </button>
                <span className="text-[10px] text-gray-600 ml-auto">Closing before opening = past midnight</span>
            </div>
        </div>
    );
};

export default OpenHoursEditor;
