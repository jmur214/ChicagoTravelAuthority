import React, { useRef, useState } from 'react';
import { MARKER_SHAPES, type Category, type MarkerShape, type Tag } from '@cta/shared';
import { api } from '../../api/client';
import { errorMessage } from '../../api/http';
import { useCategories, useTags } from '../../hooks/useApiData';
import { childCategories, rootCategories, visibleCategories } from '../../lib/categories';

const COLORS = ['#FFBF00', '#00F0FF', '#FF0099', '#7A00FF', '#3BFFFF', '#FFFF00', '#FFFFFF'];

interface Draft {
    id: number;
    name: string;
    color: string;
    shape: MarkerShape;
}

/** Run an API call, alert on failure, and refresh on success. */
const useAction = (onDone: () => void) => async (fn: () => Promise<unknown>) => {
    try {
        await fn();
        onDone();
    } catch (err) {
        alert(errorMessage(err));
    }
};

interface NodeProps {
    category: Category;
    categories: Category[];
    tags: Tag[];
    level: number;
    draft: Draft | null;
    setDraft: (d: Draft | null) => void;
    onSave: (d: Draft) => void;
    onDelete: (c: Category) => void;
    onAddChild: (c: Category) => void;
    onLinkTag: (tagId: number, categoryId: number) => void;
    onUnlinkTag: (tagId: number, categoryId: number) => void;
}

/** Module-level so the edit input keeps focus while typing (it remounted on every keystroke before). */
const CategoryNode: React.FC<NodeProps> = props => {
    const { category, categories, tags, level, draft, setDraft, onSave, onDelete, onAddChild, onLinkTag, onUnlinkTag } = props;
    const children = childCategories(categories, category.id);
    const linkedTags = tags.filter(t => t.categories?.some(c => c.id === category.id));
    const isEditing = draft?.id === category.id;

    return (
        <div className={`mb-4 ${level > 0 ? 'ml-6 border-l-2 border-white/5 pl-4' : ''}`}>
            <div className="bg-[#1e1e1e] border border-white/10 rounded-xl p-4 flex flex-col group transition-all hover:border-white/20">
                <div className="flex justify-between items-start mb-2 border-b border-white/5 pb-2">
                    {isEditing ? (
                        <div className="flex flex-col gap-2 w-full">
                            <input
                                className="bg-black/50 border border-brand-primary rounded px-2 py-1 text-white text-sm outline-none w-full"
                                value={draft.name}
                                onChange={e => setDraft({ ...draft, name: e.target.value })}
                                onKeyDown={e => e.key === 'Enter' && onSave(draft)}
                                autoFocus
                            />
                            <div className="flex gap-2 items-center">
                                {COLORS.map(c => (
                                    <button
                                        key={c}
                                        aria-label={`Color ${c}`}
                                        onClick={() => setDraft({ ...draft, color: c })}
                                        className={`w-4 h-4 rounded-full border ${draft.color === c ? 'border-white scale-125' : 'border-transparent'}`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                                <select
                                    value={draft.shape}
                                    onChange={e => setDraft({ ...draft, shape: e.target.value as MarkerShape })}
                                    className="bg-black/50 text-xs text-white border border-gray-700 rounded ml-2"
                                >
                                    {MARKER_SHAPES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className="flex gap-2 mt-1">
                                <button onClick={() => onSave(draft)} className="text-brand-primary text-xs font-bold uppercase">Save</button>
                                <button onClick={() => setDraft(null)} className="text-gray-500 text-xs">Cancel</button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 flex-1 group/title">
                            <div
                                className="w-3 h-3 flex-shrink-0"
                                style={{ backgroundColor: category.color || '#fff', borderRadius: category.shape === 'diamond' ? 0 : '50%' }}
                            />
                            <h3 className={`font-bold text-white group-hover/title:text-brand-primary transition cursor-default ${level === 0 ? 'text-lg' : 'text-sm'}`}>
                                {category.name}
                            </h3>
                            <div className="opacity-0 group-hover/title:opacity-100 focus-within:opacity-100 flex gap-2">
                                <button
                                    onClick={() => setDraft({ id: category.id, name: category.name, color: category.color || '#FFFFFF', shape: category.shape || 'circle' })}
                                    className="text-gray-500 hover:text-white text-xs"
                                    title="Edit"
                                >
                                    ✎
                                </button>
                                <button onClick={() => onDelete(category)} className="text-gray-500 hover:text-red-500 text-xs" title="Delete">🗑</button>
                                <button onClick={() => onAddChild(category)} className="text-gray-500 hover:text-brand-primary text-xs" title="Add Subcategory">+Sub</button>
                            </div>
                        </div>
                    )}

                    <select
                        className="bg-black/50 border border-white/10 rounded px-2 py-1 text-xs text-gray-400 outline-none ml-2 max-w-[120px]"
                        onChange={e => onLinkTag(Number(e.target.value), category.id)}
                        value=""
                    >
                        <option value="" disabled>+ Add Tag</option>
                        {tags.filter(t => !linkedTags.includes(t)).map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex flex-wrap gap-2 mb-2">
                    {linkedTags.map(tag => (
                        <span key={tag.id} className="bg-brand-primary/10 border border-brand-primary/20 text-brand-primary px-2 py-1 rounded text-xs flex items-center gap-2">
                            {tag.name}
                            <button onClick={() => onUnlinkTag(tag.id, category.id)} className="hover:text-white" aria-label={`Remove ${tag.name}`}>×</button>
                        </span>
                    ))}
                </div>
            </div>

            {children.length > 0 && (
                <div className="mt-2">
                    {children.map(child => (
                        <CategoryNode key={child.id} {...props} category={child} level={level + 1} />
                    ))}
                </div>
            )}
        </div>
    );
};

const CategoryManager: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { data: categories = [], reload: reloadCategories } = useCategories();
    const { data: tags = [], reload: reloadTags } = useTags();
    const [newName, setNewName] = useState('');
    const [parent, setParent] = useState<Category | null>(null);
    const [draft, setDraft] = useState<Draft | null>(null);
    const newInputRef = useRef<HTMLInputElement>(null);

    const run = useAction(() => {
        reloadCategories();
        reloadTags();
    });

    const uncategorized = tags.filter(t => !t.categories?.length);
    const assignable = visibleCategories(categories);

    const create = () => {
        if (!newName.trim()) return;
        void run(async () => {
            await api.categories.create({ name: newName, parentId: parent?.id ?? null });
            setNewName('');
            setParent(null);
        });
    };

    const nodeHandlers = {
        draft,
        setDraft,
        onSave: (d: Draft) =>
            void run(async () => {
                await api.categories.update(d.id, { name: d.name, color: d.color, shape: d.shape });
                setDraft(null);
            }),
        onDelete: (c: Category) => {
            if (!confirm(`Delete "${c.name}"? Its tags stay but are unlinked, and sub-categories move to the top level.`)) return;
            void run(() => api.categories.remove(c.id));
        },
        onAddChild: (c: Category) => {
            setNewName('');
            setParent(c);
            newInputRef.current?.focus();
        },
        onLinkTag: (tagId: number, categoryId: number) => void run(() => api.tags.addCategory(tagId, categoryId)),
        onUnlinkTag: (tagId: number, categoryId: number) => void run(() => api.tags.removeCategory(tagId, categoryId)),
    };

    return (
        <div className="fixed inset-0 z-[10001] bg-black/90 flex items-center justify-center p-8 backdrop-blur-xl">
            <div className="w-full max-w-6xl h-[85vh] bg-[#121212] border border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#1a1a1a]">
                    <div>
                        <h2 className="text-2xl font-bold text-white">Category Manager</h2>
                        <p className="text-gray-400 text-sm">Organize tags. Infinite nesting supported.</p>
                    </div>
                    <button onClick={onClose} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition">Done</button>
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
                                    <div key={tag.id} className="bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded text-sm text-gray-300">
                                        {tag.name}
                                        <select
                                            className="ml-2 bg-black border border-gray-700 rounded text-xs py-0.5 outline-none max-w-[80px]"
                                            onChange={e => nodeHandlers.onLinkTag(tag.id, Number(e.target.value))}
                                            value=""
                                        >
                                            <option value="" disabled>Add to...</option>
                                            {assignable.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Categories */}
                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-[#161616]">
                        <div className="mb-8 flex gap-4 max-w-2xl bg-[#1e1e1e] p-4 rounded-xl border border-white/5 sticky top-0 z-10 shadow-xl">
                            <div className="flex flex-col gap-1 flex-1">
                                <label className="text-xs text-gray-500">
                                    {parent ? `Adding sub-category to "${parent.name}"` : 'Adding Root Category'}
                                </label>
                                <div className="flex gap-4">
                                    <input
                                        ref={newInputRef}
                                        type="text"
                                        placeholder="New Category Name..."
                                        value={newName}
                                        onChange={e => setNewName(e.target.value)}
                                        className="flex-1 bg-black/50 border border-white/20 rounded-lg px-4 py-2 text-white outline-none focus:border-brand-primary"
                                        onKeyDown={e => e.key === 'Enter' && create()}
                                    />
                                    {parent && (
                                        <button onClick={() => setParent(null)} className="text-xs text-gray-400 hover:text-white">Cancel Parent</button>
                                    )}
                                </div>
                            </div>
                            <button onClick={create} className="px-6 py-2 bg-brand-primary text-white font-bold rounded-lg shadow-lg hover:bg-brand-primary/80 transition h-10 mt-5">
                                Create
                            </button>
                        </div>

                        <div className="flex flex-col gap-2">
                            {rootCategories(categories).map(cat => (
                                <CategoryNode key={cat.id} category={cat} categories={categories} tags={tags} level={0} {...nodeHandlers} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CategoryManager;
