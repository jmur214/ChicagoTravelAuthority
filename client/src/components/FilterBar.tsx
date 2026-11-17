import React, { useState } from 'react';
import type { Category } from '@cta/shared';
import { useCategories } from '../hooks/useApiData';
import { childCategories, rootCategories } from '../lib/categories';
import type { Filters } from '../lib/filters';

interface FilterBarProps {
    filters: Filters;
    onChange: (filters: Filters) => void;
}

interface NodeProps {
    category: Category;
    all: Category[];
    level: number;
    selected: string | undefined;
    expanded: Set<number>;
    onSelect: (name: string) => void;
    onToggleExpand: (id: number) => void;
}

/** Defined at module level so React doesn't remount the whole tree on every render. */
const FilterCategoryNode: React.FC<NodeProps> = props => {
    const { category, all, level, selected, expanded, onSelect, onToggleExpand } = props;
    const children = childCategories(all, category.id);
    const isExpanded = expanded.has(category.id);
    const isSelected = selected === category.name;

    return (
        <div className={`w-full ${level > 0 ? 'mt-1' : 'mb-2'}`}>
            <div className="flex flex-col">
                <button
                    onClick={() => onSelect(category.name)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all group border
                        ${isSelected
                            ? 'bg-brand-primary/10 border-brand-primary text-white shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                            : 'bg-transparent border-transparent text-gray-400 hover:bg-white/5 hover:text-white'}
                        ${level > 0 ? 'pl-8 text-xs' : ''}`}
                >
                    <span className="flex items-center gap-3">
                        <span
                            className={`w-2 h-2 rounded-full flex-shrink-0 ${isSelected ? 'bg-brand-primary shadow-[0_0_8px_rgba(59,130,246,0.8)]' : 'bg-gray-600 group-hover:bg-white'}`}
                            style={{ backgroundColor: category.color || undefined }}
                        />
                        {category.name}
                    </span>

                    <div className="flex items-center gap-2">
                        {isSelected && <span className="text-brand-primary">✓</span>}
                        {children.length > 0 && (
                            <span
                                role="button"
                                aria-label={isExpanded ? 'Collapse' : 'Expand'}
                                onClick={e => {
                                    e.stopPropagation();
                                    onToggleExpand(category.id);
                                }}
                                className={`p-1 rounded-md hover:bg-white/10 transition ${isExpanded ? 'rotate-180' : ''}`}
                            >
                                <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </span>
                        )}
                    </div>
                </button>

                {children.length > 0 && isExpanded && (
                    <div className="border-l border-white/5 ml-4 mt-1">
                        {children.map(child => (
                            <FilterCategoryNode key={child.id} {...props} category={child} level={level + 1} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const FilterBar: React.FC<FilterBarProps> = ({ filters, onChange }) => {
    const { data: categories = [] } = useCategories();
    const [expanded, setExpanded] = useState<Set<number>>(new Set());

    const select = (name: string | undefined) =>
        onChange({ ...filters, category: filters.category === name ? undefined : name });

    const toggleExpand = (id: number) =>
        setExpanded(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const isAll = !filters.category;

    return (
        <div className="flex flex-col gap-6 h-full">
            <div className="relative group">
                <input
                    type="text"
                    placeholder="Search places..."
                    value={filters.search}
                    onChange={e => onChange({ ...filters, search: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pl-10 text-white placeholder-gray-500 focus:outline-none focus:border-brand-primary/50 focus:bg-white/10 transition"
                />
                <svg className="w-5 h-5 text-gray-500 absolute left-3 top-3.5 group-focus-within:text-brand-primary transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <h3 className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wider">Categories</h3>
                <div className="flex flex-col">
                    <button
                        onClick={() => onChange({ ...filters, category: undefined })}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all mb-2 border ${isAll
                            ? 'bg-brand-primary/10 border-brand-primary text-white'
                            : 'bg-transparent border-transparent text-gray-400 hover:bg-white/5 hover:text-white'}`}
                    >
                        <span className={`w-2 h-2 rounded-full ${isAll ? 'bg-brand-primary' : 'bg-gray-600'}`}></span>
                        All
                    </button>
                    {rootCategories(categories).map(cat => (
                        <FilterCategoryNode
                            key={cat.id}
                            category={cat}
                            all={categories}
                            level={0}
                            selected={filters.category}
                            expanded={expanded}
                            onSelect={select}
                            onToggleExpand={toggleExpand}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default FilterBar;
