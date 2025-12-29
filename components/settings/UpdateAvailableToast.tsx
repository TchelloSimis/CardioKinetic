import React, { useEffect, useState } from 'react';
import { Download, ExternalLink } from 'lucide-react';
import { APP_VERSION } from '../../config';
import { checkForUpdates, VersionInfo } from '../../utils/versionUtils';

/**
 * Update Available Toast
 * 
 * Displays a toast notification when a newer app version is available on GitHub.
 * Only renders if an update is available; otherwise renders nothing.
 */
const UpdateAvailableToast: React.FC = () => {
    const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        let mounted = true;

        const checkVersion = async () => {
            const info = await checkForUpdates(APP_VERSION);
            if (mounted) {
                setVersionInfo(info);
                setIsChecking(false);
            }
        };

        checkVersion();

        return () => {
            mounted = false;
        };
    }, []);

    // Don't render if still checking, check failed, or no update available
    if (isChecking || !versionInfo || !versionInfo.isUpdateAvailable) {
        return null;
    }

    const handleClick = () => {
        window.open(versionInfo.downloadUrl, '_blank', 'noopener,noreferrer');
    };

    return (
        <button
            onClick={handleClick}
            className="
                w-full mb-4 p-4 
                bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-green-500/10
                dark:from-green-500/20 dark:via-emerald-500/20 dark:to-green-500/20
                border border-green-500/30 dark:border-green-500/40
                rounded-2xl
                flex items-center gap-3
                hover:border-green-500/50 hover:scale-[1.01]
                active:scale-[0.99]
                transition-all duration-200
                group
            "
        >
            {/* Download Icon */}
            <div className="
                p-2.5 rounded-xl
                bg-green-500/20 dark:bg-green-500/30
                group-hover:bg-green-500/30 dark:group-hover:bg-green-500/40
                transition-colors
            ">
                <Download
                    size={20}
                    className="text-green-600 dark:text-green-400"
                    strokeWidth={2.5}
                />
            </div>

            {/* Text Content */}
            <div className="flex-1 text-left">
                <div className="text-sm font-semibold text-green-700 dark:text-green-300">
                    Update available
                </div>
                <div className="text-xs text-green-600/80 dark:text-green-400/80">
                    v{versionInfo.latestVersion} is ready to download
                </div>
            </div>

            {/* External Link Icon */}
            <ExternalLink
                size={16}
                className="text-green-600/60 dark:text-green-400/60 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors"
            />
        </button>
    );
};

export default UpdateAvailableToast;
