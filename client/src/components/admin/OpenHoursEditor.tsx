import React from 'react';
import { DAY_KEYS, DEFAULT_DAY_HOURS, type DayHours, type DayKey, type OpenHours, type TimeWindow } from '@cta/shared';

interface OpenHoursEditorProps {
    value: OpenHours | null;
    onChange: (hours: OpenHours) => void;
}

const MAX_EXTRA_WINDOWS = 5;
const timeInput = 'bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white';

const WindowInputs: React.FC<{ day: DayKey; label: string; window: TimeWindow; onChange: (w: TimeWindow) => void }> = ({ day, label, window, onChange }) => (
    <div className="flex items-center gap-2">
        <input type="time" aria-label={`${day} ${label} opens`} value={window.open} onChange={e => onChange({ ...window, open: e.target.value })} className={timeInput} />
        <span className="text-gray-600">-</span>
        <input type="time" aria-label={`${day} ${label} closes`} value={window.close} onChange={e => onChange({ ...window, close: e.target.value })} className={timeInput} />
    </div>
);

const OpenHoursEditor: React.FC<OpenHoursEditorProps> = ({ value, onChange }) => {
    const dayHours = (day: DayKey): DayHours => value?.[day] ?? DEFAULT_DAY_HOURS;
    const setDay = (day: DayKey, next: DayHours) => {
        const { additional, ...rest } = next;
        onChange({ ...value, [day]: additional?.length ? { ...rest, additional } : rest });
    };

    const copyMondayToAll = () => {
        const monday = value?.mon ?? { ...DEFAULT_DAY_HOURS, isOpen: true };
        onChange(Object.fromEntries(DAY_KEYS.map(d => [d, structuredClone(monday)])) as OpenHours);
    };

    return (
        <div className="bg-black/20 rounded-lg p-4 border border-white/10 space-y-3">
            {DAY_KEYS.map(day => {
                const hours = dayHours(day);
                const extra = hours.additional ?? [];
                return (
                    <div key={day} className="flex items-start gap-4">
                        <div className="w-12 pt-1 text-xs font-bold uppercase text-gray-400">{day}</div>
                        <label className="flex items-center gap-2 cursor-pointer pt-1">
                            <input
                                type="checkbox"
                                checked={hours.isOpen}
                                onChange={e => setDay(day, { ...hours, isOpen: e.target.checked })}
                                className="rounded border-white/20 bg-transparent text-brand-primary focus:ring-brand-primary"
                            />
                            <span className="text-xs text-gray-500 w-12">{hours.isOpen ? 'Open' : 'Closed'}</span>
                        </label>

                        {hours.isOpen && (
                            <div className="flex flex-col gap-1.5">
                                <WindowInputs day={day} label="" window={hours} onChange={w => setDay(day, { ...hours, ...w })} />
                                {extra.map((w, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <WindowInputs
                                            day={day}
                                            label={`window ${i + 2}`}
                                            window={w}
                                            onChange={next => setDay(day, { ...hours, additional: extra.map((x, j) => (j === i ? next : x)) })}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setDay(day, { ...hours, additional: extra.filter((_, j) => j !== i) })}
                                            className="text-gray-500 hover:text-red-400 text-xs"
                                            aria-label={`Remove ${day} window ${i + 2}`}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                                {extra.length < MAX_EXTRA_WINDOWS && (
                                    <button
                                        type="button"
                                        onClick={() => setDay(day, { ...hours, additional: [...extra, { open: '17:00', close: '22:00' }] })}
                                        className="self-start text-[10px] text-gray-500 hover:text-brand-accent"
                                    >
                                        + add hours (e.g. dinner)
                                    </button>
                                )}
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
