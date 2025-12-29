import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { compareVersions, isUpdateAvailable, checkForUpdates, fetchLatestRelease } from './versionUtils';

describe('versionUtils', () => {
    describe('compareVersions', () => {
        it('should return 1 when first version is greater (major)', () => {
            expect(compareVersions('2.0.0', '1.0.0')).toBe(1);
        });

        it('should return 1 when first version is greater (minor)', () => {
            expect(compareVersions('1.5.0', '1.4.0')).toBe(1);
        });

        it('should return 1 when first version is greater (patch)', () => {
            expect(compareVersions('1.4.1', '1.4.0')).toBe(1);
        });

        it('should return -1 when first version is lesser (major)', () => {
            expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
        });

        it('should return -1 when first version is lesser (minor)', () => {
            expect(compareVersions('1.3.0', '1.4.0')).toBe(-1);
        });

        it('should return -1 when first version is lesser (patch)', () => {
            expect(compareVersions('1.4.0', '1.4.1')).toBe(-1);
        });

        it('should return 0 when versions are equal', () => {
            expect(compareVersions('1.4.0', '1.4.0')).toBe(0);
        });

        it('should handle v prefix on both versions', () => {
            expect(compareVersions('v1.5.0', 'v1.4.0')).toBe(1);
        });

        it('should handle v prefix on one version only', () => {
            expect(compareVersions('v1.5.0', '1.4.0')).toBe(1);
            expect(compareVersions('1.5.0', 'v1.4.0')).toBe(1);
        });

        it('should return 0 for invalid versions', () => {
            expect(compareVersions('invalid', '1.0.0')).toBe(0);
            expect(compareVersions('1.0.0', 'invalid')).toBe(0);
            expect(compareVersions('invalid', 'also-invalid')).toBe(0);
        });

        it('should handle version with extra text after semver', () => {
            // parseVersion only matches the initial X.Y.Z pattern
            expect(compareVersions('1.5.0-beta', '1.4.0')).toBe(1);
        });
    });

    describe('isUpdateAvailable', () => {
        it('should return true when latest is greater than current', () => {
            expect(isUpdateAvailable('1.3.0', '1.4.0')).toBe(true);
            expect(isUpdateAvailable('1.4.0', '1.5.0')).toBe(true);
            expect(isUpdateAvailable('1.4.0', '2.0.0')).toBe(true);
        });

        it('should return false when latest is equal to current', () => {
            expect(isUpdateAvailable('1.4.0', '1.4.0')).toBe(false);
        });

        it('should return false when latest is less than current', () => {
            // Edge case: user has pre-release version newer than latest stable
            expect(isUpdateAvailable('1.5.0', '1.4.0')).toBe(false);
        });

        it('should handle v prefix', () => {
            expect(isUpdateAvailable('1.3.0', 'v1.4.0')).toBe(true);
            expect(isUpdateAvailable('v1.3.0', '1.4.0')).toBe(true);
        });
    });

    describe('fetchLatestRelease', () => {
        const mockRelease = {
            tag_name: 'v1.5.0',
            html_url: 'https://github.com/TchelloSimis/CardioKinetic/releases/tag/v1.5.0',
            name: 'v1.5.0: New Features',
            published_at: '2025-12-29T00:00:00Z',
            assets: [
                {
                    name: 'CardioKinetic.apk',
                    browser_download_url: 'https://github.com/TchelloSimis/CardioKinetic/releases/download/v1.5.0/CardioKinetic.apk',
                },
            ],
        };

        beforeEach(() => {
            vi.stubGlobal('fetch', vi.fn());
        });

        afterEach(() => {
            vi.unstubAllGlobals();
        });

        it('should return release data on successful fetch', async () => {
            (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockRelease),
            });

            const result = await fetchLatestRelease();
            
            expect(result).toEqual(mockRelease);
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('api.github.com'),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Accept: 'application/vnd.github.v3+json',
                    }),
                }),
            );
        });

        it('should return null on non-ok response', async () => {
            (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                ok: false,
                status: 404,
            });

            const result = await fetchLatestRelease();
            
            expect(result).toBeNull();
        });

        it('should return null on network error', async () => {
            (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
                new Error('Network error')
            );

            const result = await fetchLatestRelease();
            
            expect(result).toBeNull();
        });
    });

    describe('checkForUpdates', () => {
        const mockRelease = {
            tag_name: 'v1.5.0',
            html_url: 'https://github.com/TchelloSimis/CardioKinetic/releases/tag/v1.5.0',
            name: 'v1.5.0: New Features',
            published_at: '2025-12-29T00:00:00Z',
            assets: [
                {
                    name: 'CardioKinetic.apk',
                    browser_download_url: 'https://github.com/TchelloSimis/CardioKinetic/releases/download/v1.5.0/CardioKinetic.apk',
                },
            ],
        };

        beforeEach(() => {
            vi.stubGlobal('fetch', vi.fn());
        });

        afterEach(() => {
            vi.unstubAllGlobals();
        });

        it('should return update info when newer version available', async () => {
            (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockRelease),
            });

            const result = await checkForUpdates('1.4.0');
            
            expect(result).toEqual({
                currentVersion: '1.4.0',
                latestVersion: '1.5.0',
                isUpdateAvailable: true,
                downloadUrl: 'https://github.com/TchelloSimis/CardioKinetic/releases/download/v1.5.0/CardioKinetic.apk',
                releaseUrl: 'https://github.com/TchelloSimis/CardioKinetic/releases/tag/v1.5.0',
                releaseName: 'v1.5.0: New Features',
            });
        });

        it('should return update info with isUpdateAvailable=false when on latest version', async () => {
            (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ ...mockRelease, tag_name: 'v1.4.0' }),
            });

            const result = await checkForUpdates('1.4.0');
            
            expect(result?.isUpdateAvailable).toBe(false);
            expect(result?.latestVersion).toBe('1.4.0');
        });

        it('should return null when fetch fails', async () => {
            (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
                new Error('Network error')
            );

            const result = await checkForUpdates('1.4.0');
            
            expect(result).toBeNull();
        });

        it('should use release html_url when no APK asset found', async () => {
            const releaseWithoutApk = {
                ...mockRelease,
                assets: [],
            };
            (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(releaseWithoutApk),
            });

            const result = await checkForUpdates('1.4.0');
            
            expect(result?.downloadUrl).toBe(mockRelease.html_url);
        });
    });
});
