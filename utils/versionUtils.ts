/**
 * Version Utilities
 * 
 * Functions for checking app updates from GitHub releases.
 */

import { GITHUB_RELEASES_API } from '../config';

/** GitHub release API response (partial) */
export interface GitHubRelease {
    tag_name: string;
    html_url: string;
    name: string;
    published_at: string;
    assets: Array<{
        name: string;
        browser_download_url: string;
    }>;
}

/** Version check result */
export interface VersionInfo {
    currentVersion: string;
    latestVersion: string;
    isUpdateAvailable: boolean;
    downloadUrl: string;
    releaseUrl: string;
    releaseName: string;
}

/**
 * Parse a semantic version string into comparable parts.
 * Handles formats: "1.0.0", "v1.0.0"
 */
function parseVersion(version: string): { major: number; minor: number; patch: number } | null {
    // Remove 'v' prefix if present
    const cleanVersion = version.replace(/^v/, '');
    const match = cleanVersion.match(/^(\d+)\.(\d+)\.(\d+)/);

    if (!match) return null;

    return {
        major: parseInt(match[1], 10),
        minor: parseInt(match[2], 10),
        patch: parseInt(match[3], 10),
    };
}

/**
 * Compare two semantic versions.
 * Returns: 1 if a > b, -1 if a < b, 0 if equal
 */
export function compareVersions(versionA: string, versionB: string): number {
    const a = parseVersion(versionA);
    const b = parseVersion(versionB);

    if (!a || !b) return 0;

    if (a.major !== b.major) return a.major > b.major ? 1 : -1;
    if (a.minor !== b.minor) return a.minor > b.minor ? 1 : -1;
    if (a.patch !== b.patch) return a.patch > b.patch ? 1 : -1;

    return 0;
}

/**
 * Check if an update is available (latest > current).
 */
export function isUpdateAvailable(currentVersion: string, latestVersion: string): boolean {
    return compareVersions(latestVersion, currentVersion) > 0;
}

/**
 * Fetch the latest release info from GitHub.
 * Returns null if the request fails or there's a network error.
 */
export async function fetchLatestRelease(): Promise<GitHubRelease | null> {
    try {
        const response = await fetch(GITHUB_RELEASES_API, {
            headers: {
                'Accept': 'application/vnd.github.v3+json',
            },
        });

        if (!response.ok) return null;

        const data: GitHubRelease = await response.json();
        return data;
    } catch {
        // Network error or other issue - fail silently
        return null;
    }
}

/**
 * Check for updates and return version info.
 * Returns null if unable to check (network error, etc.)
 */
export async function checkForUpdates(currentVersion: string): Promise<VersionInfo | null> {
    const release = await fetchLatestRelease();

    if (!release) return null;

    const latestVersion = release.tag_name.replace(/^v/, '');
    const apkAsset = release.assets.find(a => a.name.endsWith('.apk'));

    return {
        currentVersion,
        latestVersion,
        isUpdateAvailable: isUpdateAvailable(currentVersion, latestVersion),
        downloadUrl: apkAsset?.browser_download_url || release.html_url,
        releaseUrl: release.html_url,
        releaseName: release.name || `v${latestVersion}`,
    };
}
