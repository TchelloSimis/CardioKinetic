/**
 * App Configuration
 * 
 * Central configuration for app metadata and constants.
 */

/** Current app version - update this when releasing new versions */
export const APP_VERSION = '1.8.4';

/** GitHub repository path for update checks */
export const GITHUB_REPO = 'TchelloSimis/CardioKinetic';

/** GitHub API endpoint for latest release */
export const GITHUB_RELEASES_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

/** Direct download URL for latest APK */
export const GITHUB_LATEST_APK_URL = `https://github.com/${GITHUB_REPO}/releases/latest/download/CardioKinetic.apk`;
