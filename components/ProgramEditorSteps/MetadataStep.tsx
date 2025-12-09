import React from 'react';
import { FileText } from 'lucide-react';
import { EditorState } from '../ProgramEditor';

interface MetadataStepProps {
    editorState: EditorState;
    setEditorState: React.Dispatch<React.SetStateAction<EditorState>>;
}

const MetadataStep: React.FC<MetadataStepProps> = ({ editorState, setEditorState }) => {
    return (
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-4 flex items-center gap-2">
                <FileText size={14} style={{ color: 'var(--accent)' }} />
                Metadata
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                    <label className="text-xs font-medium text-neutral-500 mb-1 block">Template Name *</label>
                    <input
                        type="text"
                        value={editorState.name}
                        onChange={(e) => setEditorState(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="My Custom Program"
                        className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2.5 text-sm focus:border-neutral-400 outline-none"
                    />
                </div>
                <div className="md:col-span-2">
                    <label className="text-xs font-medium text-neutral-500 mb-1 block">Description *</label>
                    <textarea
                        value={editorState.description}
                        onChange={(e) => setEditorState(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Describe the program's goals, scientific basis, and target audience..."
                        rows={3}
                        className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2.5 text-sm focus:border-neutral-400 outline-none resize-none"
                    />
                </div>
                <div>
                    <label className="text-xs font-medium text-neutral-500 mb-1 block">Author (optional)</label>
                    <input
                        type="text"
                        value={editorState.author}
                        onChange={(e) => setEditorState(prev => ({ ...prev, author: e.target.value }))}
                        placeholder="Your name"
                        className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2.5 text-sm focus:border-neutral-400 outline-none"
                    />
                </div>
                <div>
                    <label className="text-xs font-medium text-neutral-500 mb-1 block">Tags (comma separated)</label>
                    <input
                        type="text"
                        value={editorState.tags.join(', ')}
                        onChange={(e) => setEditorState(prev => ({
                            ...prev,
                            tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                        }))}
                        placeholder="HIIT, Beginner, Fat Loss"
                        className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2.5 text-sm focus:border-neutral-400 outline-none"
                    />
                </div>
            </div>
        </div>
    );
};

export default MetadataStep;
