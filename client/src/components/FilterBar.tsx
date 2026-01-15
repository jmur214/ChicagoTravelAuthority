import React, { useState, useEffect } from 'react';
import type { Category } from '../../../shared';
import { fetchCategories } from '../api/client';

export interface Filters {
    primaryTag?: string;
    search?: string;
}

interface FilterBarProps {
    onFilterChange: (filters: Filters) => void;
}

const FilterBar: React.FC<FilterBarProps> = ({ onFilterChange }) => {
    const [selectedTag, setSelectedTag] = useState<string>('All');
    const [search, setSearch] = useState('');
    const [categories, setCategories] = useState<Category[]>([]);
    const [expandedCats, setExpandedCats] = useState<Set<number>>(new Set());

    useEffect(() => {
        fetchCategories().then(data => {
            setCategories(data);
        });
    }, []);

    const handleTagClick = (tag: string) => {
        const newTag = selectedTag === tag ? 'All' : tag;
        setSelectedTag(newTag);
        onFilterChange({ primaryTag: newTag, search });
    };

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value);
        onFilterChange({ primaryTag: selectedTag, search: e.target.value });
    };

    const toggleExpand = (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        const newSet = new Set(expandedCats);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpandedCats(newSet);
    };

    const getChildren = (id: number) => categories.filter(c => c.parentId === id);
    const rootCategories = categories.filter(c => !c.parentId && c.name !== 'Folder');

    const FilterCategoryNode: React.FC<{ category: Category, level?: number }> = ({ category, level = 0 }) => {
        const children = getChildren(category.id);
        const hasChildren = children.length > 0;
        const isExpanded = expandedCats.has(category.id);
        const isSelected = selectedTag === category.name;

        return (
            <div className={`w-full ${level > 0 ? 'mt-1' : 'mb-2'}`}>
                <div className="flex flex-col">
                    <button
                        onClick={() => handleTagClick(category.name)}
                        className={`
                            w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all group border
                            ${isSelected
                                ? 'bg-brand-primary/10 border-brand-primary text-white shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                                : 'bg-transparent border-transparent text-gray-400 hover:bg-white/5 hover:text-white'
                            }
                            ${level > 0 ? 'pl-8 text-xs' : ''}
                        `}
                    >
                        <span className="flex items-center gap-3">
                            <span
                                className={`w-2 h-2 rounded-full flex-shrink-0
                                ${isSelected ? 'bg-brand-primary shadow-[0_0_8px_rgba(59,130,246,0.8)]' : 'bg-gray-600 group-hover:bg-white'}
                                `}
                                style={{ backgroundColor: (category as any).color || undefined }}
                            />
                            {category.name}
                        </span>

                        <div className="flex items-center gap-2">
                            {isSelected && <span className="text-brand-primary">✓</span>}
                            {hasChildren && (
                                <div
                                    onClick={(e) => toggleExpand(category.id, e)}
                                    className={`p-1 rounded-md hover:bg-white/10 transition ${isExpanded ? 'rotate-180' : ''}`}
                                >
                                    <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            )}
                        </div>
                    </button>

                    {hasChildren && isExpanded && (
                        <div className="border-l border-white/5 ml-4 mt-1">
                            {children.map(child => (
                                <FilterCategoryNode key={child.id} category={child} level={level + 1} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-6 h-full">

            {/* Search Input */}
            <div>
                <div className="relative group">
                    <input
                        type="text"
                        placeholder="Search places..."
                        value={search}
                        onChange={handleSearch}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pl-10 text-white placeholder-gray-500 focus:outline-none focus:border-brand-primary/50 focus:bg-white/10 transition"
                    />
                    <svg className="w-5 h-5 text-gray-500 absolute left-3 top-3.5 group-focus-within:text-brand-primary transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
            </div>

            {/* Filter Pills */}
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <h3 className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wider">Categories</h3>
                <div className="flex flex-col">
                    <button
                        onClick={() => handleTagClick('All')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all mb-2 border ${selectedTag === 'All'
                            ? 'bg-brand-primary/10 border-brand-primary text-white'
                            : 'bg-transparent border-transparent text-gray-400 hover:bg-white/5 hover:text-white'
                            }`}
                    >
                        <span className={`w-2 h-2 rounded-full ${selectedTag === 'All' ? 'bg-brand-primary' : 'bg-gray-600'}`}></span>
                        All
                    </button>
                    {rootCategories.map(cat => (
                        <FilterCategoryNode key={cat.id} category={cat} />
                    ))}
                </div>
            </div>

        </div>
    );
};

export default FilterBar;
