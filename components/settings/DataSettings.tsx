import React from 'react';
import { ProgramRecord, Session } from '../../types';
import { AccentColor } from '../../presets';

export interface DataSettingsProps {
    programs: ProgramRecord[];
    sessions: Session[];
    setPrograms: (programs: ProgramRecord[]) => void;
    setSessions: (sessions: Session[]) => void;
    accentColor: AccentColor;
    setAccentColor: (value: AccentColor) => void;
}

const DataSettings: React.FC<DataSettingsProps> = ({
    programs,
    sessions,
    setPrograms,
    setSessions,
    accentColor,
    setAccentColor,
}) => {
    const handleExport = () => {
        const data = {
            programs,
            sessions,
            accentColor,
            exportedAt: new Date().toISOString(),
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cardiokinetic-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImport = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const data = JSON.parse(event.target?.result as string);
                        if (data.programs && data.sessions) {
                            if (window.confirm('This will replace all your current data. Continue?')) {
                                setPrograms(data.programs);
                                setSessions(data.sessions);
                                if (data.accentColor) setAccentColor(data.accentColor);
                                alert('Data imported successfully!');
                            }
                        } else {
                            alert('Invalid backup file format.');
                        }
                    } catch (err) {
                        alert('Failed to parse backup file.');
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-light text-neutral-900 dark:text-white tracking-tight">Data</h2>

            {/* Data Management */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
                <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-4">Backup & Restore</h3>
                <div className="flex gap-3">
                    <button
                        onClick={handleExport}
                        className="flex-1 py-3 px-4 rounded-xl text-sm font-bold uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors focus:outline-none"
                    >
                        Export
                    </button>
                    <button
                        onClick={handleImport}
                        className="flex-1 py-3 px-4 rounded-xl text-sm font-bold uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors focus:outline-none"
                    >
                        Import
                    </button>
                </div>
                <p className="text-xs text-neutral-500 mt-3">Backup or restore your programs and sessions</p>
            </div>
        </div>
    );
};

export default DataSettings;
