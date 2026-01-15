
import React, { useState, useEffect } from 'react';
import type { Tag } from '../../../shared';

interface Category {
    id: number;
    name: string;
    isSingleSelect: boolean;
    tags: Tag[];
    parentId?: number;
    children?: Category[];
}

const CategoryManager: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [newCatName, setNewCatName] = useState('');
    const [selectedParentId, setSelectedParentId] = useState<number | null>(null);
    const [tags, setTags] = useState<Tag[]>([]);
    const [editingCategory, setEditingCategory] = useState<{ id: number, name: string, color?: string, shape?: string } | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const [catsRes, tagsRes] = await Promise.all([
            fetch('http://localhost:3000/api/categories').then(r => r.json()),
            fetch('http://localhost:3000/api/tags').then(r => r.json())
        ]);
        setCategories(catsRes);
        setTags(tagsRes);
    };

    const handleCreateCategory = async () => {
        if (!newCatName) return;
        await fetch('http://localhost:3000/api/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newCatName, parentId: selectedParentId })
        });
        setNewCatName('');
        setSelectedParentId(null);
        loadData();
    };

    const handleDeleteCategory = async (id: number) => {
        if (!confirm('Are you sure? This will delete the category. Tags will remain but be unlinked from this category.')) return;
        await fetch(`http://localhost:3000/api/categories/${id}`, { method: 'DELETE' });
        loadData();
    };

    const handleUpdateCategory = async (id: number) => {
        if (!editingCategory) return;
        await fetch(`http://localhost:3000/api/categories/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: editingCategory.name,
                color: editingCategory.color,
                shape: editingCategory.shape
            })
        });
        setEditingCategory(null);
        loadData();
    };

    const handleAddTagToCategory = async (tagId: number, categoryId: number) => {
        await fetch(`http://localhost:3000/api/tags/${tagId}/categories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categoryId })
        });
        loadData();
    };

    const handleRemoveTagFromCategory = async (tagId: number, categoryId: number) => {
        await fetch(`http://localhost:3000/api/tags/${tagId}/categories/${categoryId}`, {
            method: 'DELETE'
        });
        loadData();
    };

    // Calculate Uncategorized Tags
    const uncategorized = tags.filter(t => !t.categories || t.categories.length === 0);

    // Group logic for display
    const rootCategories = categories.filter(c => !c.parentId && c.name !== 'Folder');
    const getChildren = (id: number) => categories.filter(c => c.parentId === id);

    const COLORS = ['#FFBF00', '#00F0FF', '#FF0099', '#7A00FF', '#3BFFFF', '#FFff00', '#ffffff'];
    const SHAPES = ['circle', 'star', 'diamond', 'ring'];

    // Recursive Component
    const CategoryNode: React.FC<{
        category: Category,
        level?: number
    }> = ({ category, level = 0 }) => {
        const children = getChildren(category.id);
        const catTags = tags.filter(t => t.categories?.some((tc: any) => tc.id === category.id));
        const isEditing = editingCategory?.id === category.id;

        return (
            <div className={`mb-4 ${level > 0 ? 'ml-6 border-l-2 border-white/5 pl-4' : ''}`}>
                <div className="bg-[#1e1e1e] border border-white/10 rounded-xl p-4 flex flex-col group transition-all hover:border-white/20">
                    <div className="flex justify-between items-start mb-2 border-b border-white/5 pb-2">
                        {/* Edit Mode Logic */}
                        {isEditing ? (
                            <div className="flex flex-col gap-2 w-full">
                                <input
                                    className="bg-black/50 border border-brand-primary rounded px-2 py-1 text-white text-sm outline-none w-full"
                                    value={editingCategory.name}
                                    onChange={e => setEditingCategory({ ...editingCategory, name: e.target.value })}
                                    onKeyDown={e => e.key === 'Enter' && handleUpdateCategory(category.id)}
                                    autoFocus
                                />
                                <div className="flex gap-2 items-center">
                                    {/* Color Picker */}
                                    {COLORS.map(c => (
                                        <button
                                            key={c}
                                            onClick={() => setEditingCategory({ ...editingCategory, color: c })}
                                            className={`w-4 h-4 rounded-full border ${editingCategory.color === c ? 'border-white scale-125' : 'border-transparent'}`}
                                            style={{ backgroundColor: c }}
                                        />
                                    ))}
                                    {/* Shape Picker */}
                                    <select
                                        value={editingCategory.shape || 'circle'}
                                        onChange={e => setEditingCategory({ ...editingCategory, shape: e.target.value })}
                                        className="bg-black/50 text-xs text-white border border-gray-700 rounded ml-2"
                                    >
                                        {SHAPES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div className="flex gap-2 mt-1">
                                    <button onClick={() => handleUpdateCategory(category.id)} className="text-brand-primary text-xs font-bold uppercase">Save</button>
                                    <button onClick={() => setEditingCategory(null)} className="text-gray-500 text-xs">Cancel</button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 flex-1 group/title">
                                <div
                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: (category as any).color || '#fff', borderRadius: (category as any).shape === 'diamond' ? '0' : '50%' }}
                                />
                                <h3 className={`font-bold text-white group-hover/title:text-brand-primary transition cursor-default ${level === 0 ? 'text-lg' : 'text-sm'}`}>
                                    {category.name}
                                </h3>
                                <div className="opacity-0 group-hover/title:opacity-100 flex gap-2">
                                    <button onClick={() => setEditingCategory({ id: category.id, name: category.name, color: (category as any).color, shape: (category as any).shape })} className="text-gray-500 hover:text-white text-xs">
                                        ✎
                                    </button>
                                    <button onClick={() => handleDeleteCategory(category.id)} className="text-gray-500 hover:text-red-500 text-xs">
                                        🗑
                                    </button>
                                    {/* Add Child Button */}
                                    <button
                                        onClick={() => {
                                            setNewCatName('');
                                            setSelectedParentId(category.id);
                                            // Ideally focus the top input or open a modal, for now just setting state
                                            const input = document.getElementById('new-cat-input');
                                            if (input) input.focus();
                                        }}
                                        className="text-gray-500 hover:text-brand-primary text-xs"
                                        title="Add Subcategory"
                                    >
                                        +Sub
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Add Tag to Category Dropdown */}
                        <select
                            className="bg-black/50 border border-white/10 rounded px-2 py-1 text-xs text-gray-400 outline-none ml-2 max-w-[120px]"
                            onChange={(e) => handleAddTagToCategory(Number(e.target.value), category.id)}
                            value=""
                        >
                            <option value="" disabled>+ Add Tag</option>
                            {tags.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Direct Tags */}
                    <div className="flex flex-wrap gap-2 mb-2">
                        {catTags.map(tag => (
                            <span key={tag.id} className="bg-brand-primary/10 border border-brand-primary/20 text-brand-primary px-2 py-1 rounded text-xs flex items-center gap-2">
                                {tag.name}
                                <button onClick={() => handleRemoveTagFromCategory(tag.id, category.id)} className="hover:text-white">×</button>
                            </span>
                        ))}
                    </div>

                </div>

                {/* Recursive Children */}
                {children.length > 0 && (
                    <div className="mt-2">
                        {children.map(child => (
                            <CategoryNode key={child.id} category={child} level={level + 1} />
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[10001] bg-black/90 flex items-center justify-center p-8 backdrop-blur-xl">
            <div className="w-full max-w-6xl h-[85vh] bg-[#121212] border border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-2xl">

                {/* Header */}
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#1a1a1a]">
                    <div>
                        <h2 className="text-2xl font-bold text-white">Category Manager</h2>
                        <p className="text-gray-400 text-sm">Organize tags. Infinite nesting supported.</p>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={onClose} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition">
                            Done
                        </button>
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden">

                    {/* Uncategorized Sidebar */}
                    <div className="w-1/4 border-r border-white/10 bg-[#0a0a0a] flex flex-col">
                        <div className="p-4 border-b border-white/10 bg-[#121212]">
                            <h3 className="font-bold text-gray-400 uppercase tracking-wider text-xs">Uncategorized Tags ({uncategorized.length})</h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            <div className="flex flex-wrap gap-2">
                                {uncategorized.map(tag => (
                                    <div key={tag.id} className="draggable-tag bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded text-sm text-gray-300">
                                        {tag.name}
                                        <select
                                            className="ml-2 bg-black border border-gray-700 rounded text-xs py-0.5 outline-none max-w-[80px]"
                                            onChange={(e) => handleAddTagToCategory(tag.id, Number(e.target.value))}
                                            value=""
                                        >
                                            <option value="" disabled>Add to...</option>
                                            {categories.filter(c => c.name !== 'Folder').map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Categories Grid */}
                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-[#161616]">

                        {/* Add New Category Form */}
                        <div className="mb-8 flex gap-4 max-w-2xl bg-[#1e1e1e] p-4 rounded-xl border border-white/5 sticky top-0 z-10 shadow-xl">
                            <div className="flex flex-col gap-1 flex-1">
                                <label className="text-xs text-gray-500">{selectedParentId ? `Adding sub-category to ID: ${selectedParentId}` : 'Adding Root Category'}</label>
                                <div className="flex gap-4">
                                    <input
                                        id="new-cat-input"
                                        type="text"
                                        placeholder="New Category Name..."
                                        value={newCatName}
                                        onChange={e => setNewCatName(e.target.value)}
                                        className="flex-1 bg-black/50 border border-white/20 rounded-lg px-4 py-2 text-white outline-none focus:border-brand-primary"
                                        onKeyDown={e => e.key === 'Enter' && handleCreateCategory()}
                                    />
                                    {selectedParentId && (
                                        <button onClick={() => setSelectedParentId(null)} className="text-xs text-gray-400 hover:text-white">
                                            Cancel Parent
                                        </button>
                                    )}
                                </div>
                            </div>

                            <button onClick={handleCreateCategory} className="px-6 py-2 bg-brand-primary text-white font-bold rounded-lg shadow-lg hover:bg-brand-primary/80 transition h-10 mt-5">
                                Create
                            </button>
                        </div>

                        <div className="flex flex-col gap-2">
                            {rootCategories.map(cat => (
                                <CategoryNode key={cat.id} category={cat} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CategoryManager;
