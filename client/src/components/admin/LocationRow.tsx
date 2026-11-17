import React from 'react';
import type { Category, Location, Tag } from '@cta/shared';
import { suggestedCategories, visibleCategories } from '../../lib/categories';
import { priceLabel } from '../../lib/datetime';

interface LocationRowProps {
    location: Location;
    allCategories: Category[];
    allTags: Tag[];
    onApprove: () => void;
    onSetVibe: (verified: boolean) => void;
    onAddCategories: (categoryIds: number[]) => void;
    onEdit: () => void;
    onDelete: () => void;
}

const LocationRow: React.FC<LocationRowProps> = ({ location: loc, allCategories, allTags, onApprove, onSetVibe, onAddCategories, onEdit, onDelete }) => {
    const suggestions = suggestedCategories(loc, allTags);
    const assignable = visibleCategories(allCategories).filter(cat => !loc.categories.some(c => c.id === cat.id));

    return (
        <tr className={`hover:bg-white/5 transition group ${loc.isConfirmed ? '' : 'bg-yellow-900/10'}`}>
            <td className="p-4 font-medium text-white">
                <div className="flex items-center gap-2">
                    {!loc.isConfirmed && <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" title="Needs Verification"></span>}
                    {loc.name}
                </div>
            </td>
            <td className="p-4 text-gray-400 max-w-xs truncate">{loc.description}</td>
            <td className="p-4 text-xs font-mono">
                <div className="flex flex-col gap-2">
                    {loc.isConfirmed ? (
                        <span className="text-green-500 flex items-center gap-1">✓ Confirmed</span>
                    ) : (
                        <button onClick={onApprove} className="text-yellow-500 hover:text-yellow-400 underline decoration-dotted text-left">
                            Approve Data
                        </button>
                    )}
                    {loc.verifiedVibe ? (
                        <button onClick={() => onSetVibe(false)} className="text-brand-accent hover:text-white flex items-center gap-1">
                            ★ Verified Vibe
                        </button>
                    ) : (
                        <button onClick={() => onSetVibe(true)} className="text-gray-600 hover:text-brand-accent text-left">
                            ☆ Mark Vibe
                        </button>
                    )}
                </div>
            </td>
            <td className="p-4 text-gray-400 text-xs">{priceLabel(loc.avgCost)}</td>
            <td className="p-4 text-gray-400 text-xs text-nowrap">{loc.avgStayMinutes}m</td>
            <td className="p-4">
                <div className="flex flex-wrap gap-1">
                    {loc.tags.map(t => (
                        <span key={t.tag.id} className="px-2 py-0.5 rounded text-xs bg-white/10 text-gray-400 border border-white/10">
                            {t.tag.name}
                        </span>
                    ))}
                </div>
            </td>
            <td className="p-4">
                <div className="flex flex-col gap-2 min-w-[200px]">
                    <div className="flex flex-wrap gap-1">
                        {loc.categories.map(c => (
                            <span key={c.id} className="px-2 py-0.5 rounded text-xs bg-brand-accent/20 text-brand-accent border border-brand-accent/30 font-bold">
                                {c.name}
                            </span>
                        ))}
                    </div>

                    {suggestions.length > 0 && (
                        <div className="flex flex-wrap gap-1 items-center">
                            <span className="text-[10px] text-brand-primary uppercase font-bold mr-1">✨ Suggested:</span>
                            {suggestions.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => onAddCategories([s.id])}
                                    className="px-2 py-0.5 rounded text-[10px] border border-dashed border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white transition"
                                    title="Click to add this category"
                                >
                                    + {s.name}
                                </button>
                            ))}
                            {suggestions.length > 1 && (
                                <button
                                    onClick={() => onAddCategories(suggestions.map(s => s.id))}
                                    className="ml-1 px-2 py-0.5 rounded text-[10px] bg-brand-primary text-white font-bold hover:bg-white hover:text-black transition"
                                >
                                    Add All
                                </button>
                            )}
                        </div>
                    )}

                    <select
                        className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-gray-400 outline-none hover:bg-white/10 transition mt-1 w-full max-w-[150px]"
                        onChange={e => onAddCategories([Number(e.target.value)])}
                        value=""
                    >
                        <option value="" disabled>+ Add Category</option>
                        {assignable.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                    </select>
                </div>
            </td>
            <td className="p-4 text-right opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
                <button onClick={onEdit} className="text-brand-accent hover:text-white mr-3 text-sm">Edit</button>
                <button onClick={onDelete} className="text-red-500 hover:text-red-400 text-sm">Delete</button>
            </td>
        </tr>
    );
};

export default LocationRow;
