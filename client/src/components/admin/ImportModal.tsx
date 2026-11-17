import React, { useState } from 'react';
import { api } from '../../api/client';
import { errorMessage } from '../../api/http';

const ImportModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [status, setStatus] = useState<{ tone: 'info' | 'ok' | 'error'; text: string } | null>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = ''; // allow re-selecting the same file
        if (!file) return;

        setStatus({ tone: 'info', text: 'Uploading...' });
        try {
            const r = await api.importKml(file);
            const parts = [`${r.imported} new`, `${r.updated} updated`];
            if (r.errors) parts.push(`${r.errors} failed`);
            setStatus({
                tone: r.errors ? 'error' : 'ok',
                text: r.total ? `Processed ${r.total} places: ${parts.join(', ')}. New places await review.` : 'No places found in that file.',
            });
        } catch (err) {
            setStatus({ tone: 'error', text: errorMessage(err) });
        }
    };

    const toneClass = { info: 'text-gray-300', ok: 'text-brand-accent', error: 'text-red-400' };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-[10001]">
            <div className="glass-panel p-8 rounded-2xl shadow-2xl w-full max-w-md bg-[#121212]">
                <h2 className="text-2xl font-bold mb-2 text-white">Import KML</h2>
                <p className="text-sm text-gray-400 mb-6">
                    Upload a Google My Maps / Google Earth KML or KMZ export. Folder names become tags.
                </p>

                <label className="block border-2 border-dashed border-white/20 rounded-xl p-8 text-center hover:border-brand-primary/50 transition cursor-pointer bg-white/5">
                    <input type="file" accept=".kml,.kmz,.xml" onChange={handleFileChange} className="hidden" />
                    <span className="flex flex-col items-center">
                        <span className="text-4xl mb-2">📂</span>
                        <span className="text-sm font-medium text-brand-primary">Click to choose a file</span>
                    </span>
                </label>

                <div className={`mt-4 text-sm font-medium text-center min-h-6 ${status ? toneClass[status.tone] : ''}`}>{status?.text}</div>

                <div className="mt-6 flex justify-end">
                    <button onClick={onClose} className="text-gray-400 hover:text-white px-4 py-2 text-sm font-medium transition">Close</button>
                </div>
            </div>
        </div>
    );
};

export default ImportModal;
