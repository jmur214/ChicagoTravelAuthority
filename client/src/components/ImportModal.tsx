import React, { useRef, useState } from 'react';
import { importKml } from '../api/client';

interface ImportModalProps {
    onClose: () => void;
}

const ImportModal: React.FC<ImportModalProps> = ({ onClose }) => {
    const fileInput = useRef<HTMLInputElement>(null);
    const [status, setStatus] = useState<string>('');

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setStatus('Uploading...');
            const res = await importKml(e.target.files[0]);
            if (res.error) {
                setStatus('Error: ' + res.error);
            } else {
                setStatus(`Imported ${res.results.imported} locations!`);
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-[3000]">
            <div className="glass-panel p-8 rounded-2xl shadow-2xl w-full max-w-md bg-[#121212]">
                <h2 className="text-2xl font-bold mb-2 text-white">Import KML</h2>
                <p className="text-sm text-gray-400 mb-6">
                    Upload a Google Earth KML/KMZ file to populate the map.
                </p>

                <div className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center hover:border-brand-primary/50 transition cursor-pointer bg-white/5">
                    <input
                        type="file"
                        accept=".kml,.kmz,.xml"
                        ref={fileInput}
                        onChange={handleFileChange}
                        className="hidden"
                        id="file-upload"
                    />
                    <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                        <span className="text-4xl mb-2">📂</span>
                        <span className="text-sm font-medium text-brand-primary">Click to upload</span>
                        <span className="text-xs text-gray-500 mt-1">or drag and drop</span>
                    </label>
                </div>

                <div className="mt-4 text-sm font-medium text-center h-6 text-brand-accent">
                    {status}
                </div>

                <div className="mt-6 flex justify-end">
                    <button onClick={onClose} className="text-gray-400 hover:text-white px-4 py-2 text-sm font-medium transition">Close</button>
                </div>
            </div>
        </div>
    );
};

export default ImportModal;
