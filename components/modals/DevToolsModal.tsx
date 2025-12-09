import React from 'react';
import { X, Database, Calendar, CheckSquare, Trash2 } from 'lucide-react';

interface DevToolsModalProps {
    onClose: () => void;
    sampleWeeks: number;
    setSampleWeeks: (weeks: number) => void;
    programLength: number;
    simulatedCurrentDate: string;
    setSimulatedCurrentDate: (date: string) => void;
    autoUpdateSimDate: boolean;
    setAutoUpdateSimDate: (auto: boolean) => void;
    jumpToLastSession: () => void;
    generateSampleData: () => void;
    clearSessions: () => void;
}

const DevToolsModal: React.FC<DevToolsModalProps> = ({
    onClose,
    sampleWeeks,
    setSampleWeeks,
    programLength,
    simulatedCurrentDate,
    setSimulatedCurrentDate,
    autoUpdateSimDate,
    setAutoUpdateSimDate,
    jumpToLastSession,
    generateSampleData,
    clearSessions,
}) => {
    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-neutral-900 p-6 rounded-2xl shadow-2xl max-w-sm w-full border border-neutral-200 dark:border-neutral-800 scale-100 animate-in zoom-in-95 duration-200 relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"> <X size={20} /> </button>
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-neutral-900 dark:text-white"><Database size={20} /></div>
                    <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Developer Tools</h3>
                </div>
                <div className="mb-6 space-y-4">
                    <div>
                        <label className="text-[10px] font-bold uppercase text-neutral-400 tracking-widest mb-2 block">Weeks to Simulate</label>
                        <div className="flex items-center gap-4">
                            <input type="range" min="1" max={programLength} value={sampleWeeks} onChange={(e) => setSampleWeeks(Number(e.target.value))} className="flex-1 h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full appearance-none cursor-pointer accent-neutral-900 dark:accent-white" />
                            <span className="font-mono font-bold text-lg w-8 text-right">{sampleWeeks}</span>
                        </div>
                    </div>
                    <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800">
                        <label className="text-[10px] font-bold uppercase text-neutral-400 tracking-widest mb-2 block">Simulate Current Date</label>
                        <div className="flex gap-2 mb-3">
                            <input type="date" value={simulatedCurrentDate} onChange={(e) => setSimulatedCurrentDate(e.target.value)} className="flex-1 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm font-mono" />
                            <button onClick={jumpToLastSession} className="px-3 py-2 bg-neutral-200 dark:bg-neutral-800 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors" title="Jump to last session"><Calendar size={16} /></button>
                        </div>
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <div className="relative">
                                <input type="checkbox" className="peer sr-only" checked={autoUpdateSimDate} onChange={(e) => setAutoUpdateSimDate(e.target.checked)} />
                                <div className="w-5 h-5 border-2 border-neutral-300 dark:border-neutral-600 rounded flex items-center justify-center peer-checked:bg-neutral-900 dark:peer-checked:bg-white peer-checked:border-transparent transition-colors">
                                    {autoUpdateSimDate && <CheckSquare size={12} className="text-white dark:text-black" />}
                                </div>
                            </div>
                            <span className="text-xs text-neutral-600 dark:text-neutral-400 select-none">Auto-set date to last generated session</span>
                        </label>
                    </div>
                </div>
                <div className="flex flex-col gap-3">
                    <button onClick={generateSampleData} className="w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider bg-neutral-900 dark:bg-white text-white dark:text-black hover:opacity-90 transition-opacity flex items-center justify-center gap-2"><Database size={14} /> Generate Data</button>
                    <button onClick={clearSessions} className="w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors flex items-center justify-center gap-2"><Trash2 size={14} /> Clear Sessions</button>
                    <div className="pt-3 mt-3 border-t border-neutral-200 dark:border-neutral-800">
                        <button onClick={() => {
                            if (window.confirm('This will permanently delete ALL data including programs, sessions, and settings. This cannot be undone. Are you sure?')) {
                                localStorage.clear();
                                window.location.reload();
                            }
                        }} className="w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider bg-red-600 text-white hover:bg-red-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red-500/20"><Trash2 size={14} /> Factory Reset</button>
                        <p className="text-[10px] text-neutral-400 text-center mt-2">Clears all data and restarts the app</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DevToolsModal;
