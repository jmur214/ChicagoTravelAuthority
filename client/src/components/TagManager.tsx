import React, { useState, useEffect } from 'react';
import type { Tag } from '../../../shared';
import { fetchTags, createTag, updateTag, deleteTag } from '../api/client';

const TagManager: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [tags, setTags] = useState<Tag[]>([]);
    const [newTag, setNewTag] = useState('');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState('');

    useEffect(() => {
        loadTags();
    }, []);

    const loadTags = async () => {
        const data = await fetchTags();
        setTags(data);
    };

    const handleCreate = async () => {
        if (!newTag.trim()) return;
        await createTag(newTag);
        setNewTag('');
        loadTags();
    };

    const handleUpdate = async (id: number) => {
        if (!editName.trim()) return;
        await updateTag(id, { name: editName, categoryId: 1 }); // Default category
        setEditingId(null);
        loadTags();
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Delete this tag?')) return;
        try {
            await deleteTag(id);
            setTags(tags.filter(t => t.id !== id));
        } catch (e) {
            alert('Cannot delete tag in use');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[2050] flex justify-center items-center p-8">
            <div className="glass-panel w-full max-w-2xl h-[70vh] rounded-2xl flex flex-col bg-[#121212]">
                <div className="p-6 border-b border-white/10 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white">Tag Manager</h2>
                    <button onClick={onClose} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded text-white text-sm">Close</button>
                </div>

                <div className="p-4 bg-white/5 border-b border-white/10 flex gap-2">
                    <input
                        className="flex-1 bg-black/50 border border-white/10 rounded px-3 py-2 text-white"
                        placeholder="New tag name..."
                        value={newTag}
                        onChange={e => setNewTag(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleCreate()}
                    />
                    <button onClick={handleCreate} className="px-4 py-2 bg-brand-primary text-white rounded hover:bg-brand-primary/80">Add Tag</button>
                </div>

                <div className="flex-1 overflow-auto p-4">
                    <div className="grid gap-2">
                        {tags.map(tag => (
                            <div key={tag.id} className="flex items-center justify-between p-3 bg-white/5 rounded border border-white/5 hover:border-white/10">
                                {editingId === tag.id ? (
                                    <div className="flex gap-2 flex-1">
                                        <input
                                            className="flex-1 bg-black/50 border border-brand-primary rounded px-2 text-white"
                                            value={editName}
                                            onChange={e => setEditName(e.target.value)}
                                            autoFocus
                                        />
                                        <button onClick={() => handleUpdate(tag.id)} className="text-green-400 text-xs uppercase font-bold">Save</button>
                                        <button onClick={() => setEditingId(null)} className="text-gray-400 text-xs uppercase font-bold">Cancel</button>
                                    </div>
                                ) : (
                                    <>
                                        <span className="text-white">{tag.name}</span>
                                        <div className="flex gap-3">
                                            <button onClick={() => { setEditingId(tag.id); setEditName(tag.name); }} className="text-brand-accent hover:text-white text-xs">Edit</button>
                                            <button onClick={() => handleDelete(tag.id)} className="text-red-500 hover:text-red-400 text-xs">Delete</button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TagManager;
