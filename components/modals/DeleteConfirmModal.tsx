import React from 'react';

interface DeleteConfirmModalProps {
    onClose: () => void;
    onConfirm: () => void;
    title?: string;
    message?: string;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
    onClose,
    onConfirm,
    title = "Delete Session?",
    message = "This action cannot be undone."
}) => {
    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-neutral-900 p-6 rounded-2xl shadow-2xl max-w-sm w-full border border-neutral-200 dark:border-neutral-800 scale-100 animate-in zoom-in-95 duration-200">
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">{title}</h3>
                <p className="text-sm text-neutral-500 mb-6">{message}</p>
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors">Cancel</button>
                    <button onClick={onConfirm} className="flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wider bg-red-600 text-white shadow-lg shadow-red-500/30 hover:bg-red-700 transition-colors">Delete</button>
                </div>
            </div>
        </div>
    );
};

export default DeleteConfirmModal;
