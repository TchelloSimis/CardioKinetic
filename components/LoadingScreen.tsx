import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingScreenProps {
    message: string;
    details?: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ message, details }) => {
    return (
        <div className="fixed inset-0 bg-neutral-100 dark:bg-black flex flex-col items-center justify-center z-[9999]">
            <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
                <Loader2 size={48} className="text-neutral-900 dark:text-white animate-spin mb-6" />
                <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">{message}</h2>
                {details && (
                    <p className="text-neutral-500 font-mono text-sm">{details}</p>
                )}
            </div>
        </div>
    );
};

export default LoadingScreen;
