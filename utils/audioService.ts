/**
 * Audio Service for Live Session Guide
 * 
 * Handles playing audio cues during guided sessions.
 * Uses Web Audio API for browser, with fallback to HTML5 Audio.
 * Works with foreground service on Android for background audio support.
 */

import { Capacitor } from '@capacitor/core';

// Audio cue types
export type AudioCue =
    | 'work_start'
    | 'rest_start'
    | 'countdown'
    | 'session_complete'
    | 'halfway'
    | 'last_interval'
    | 'steady_reminder';

// Audio context for Web Audio API
let audioContext: AudioContext | null = null;

// Cache for loaded audio buffers
const audioBuffers: Map<AudioCue, AudioBuffer> = new Map();

// Audio file paths
const AUDIO_PATHS: Record<AudioCue, string> = {
    work_start: '/audio/work_start.mp3',
    rest_start: '/audio/rest_start.mp3',
    countdown: '/audio/countdown.mp3',
    session_complete: '/audio/session_complete.mp3',
    halfway: '/audio/halfway.mp3',
    last_interval: '/audio/last_interval.mp3',
    steady_reminder: '/audio/steady_reminder.mp3',
};

/**
 * Initialize the audio context (must be called after user interaction)
 */
export const initAudioContext = (): void => {
    if (!audioContext) {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    // Resume context if suspended (browsers suspend until user interaction)
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
};

/**
 * Ensure audio context is resumed (especially important on Android when returning from background)
 */
const ensureAudioContextActive = async (): Promise<void> => {
    if (!audioContext) {
        initAudioContext();
    }

    if (audioContext?.state === 'suspended') {
        try {
            await audioContext.resume();
        } catch (error) {
            console.warn('Failed to resume audio context:', error);
        }
    }
};

/**
 * Preload all audio files into memory for instant playback
 */
export const preloadAudio = async (): Promise<void> => {
    initAudioContext();
    if (!audioContext) return;

    const loadPromises = Object.entries(AUDIO_PATHS).map(async ([cue, path]) => {
        try {
            const response = await fetch(path);
            if (!response.ok) {
                console.warn(`Audio file not found: ${path}, will use generated tone`);
                return;
            }
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await audioContext!.decodeAudioData(arrayBuffer);
            audioBuffers.set(cue as AudioCue, audioBuffer);
        } catch (error) {
            console.warn(`Failed to load audio ${cue}:`, error);
        }
    });

    await Promise.all(loadPromises);
};

/**
 * Generate a simple tone using Web Audio API oscillator
 * Used as fallback when audio files aren't available
 */
const playGeneratedTone = (
    frequency: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume: number = 0.3
): void => {
    if (!audioContext) {
        initAudioContext();
    }
    if (!audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);

    // Fade in/out for smooth sound
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.01);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + duration);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
};

/**
 * Fallback tones for each cue type (used when audio files not available)
 */
const FALLBACK_TONES: Record<AudioCue, () => void> = {
    work_start: () => {
        // Energetic double beep (high pitch)
        playGeneratedTone(880, 0.15, 'square', 0.4);
        setTimeout(() => playGeneratedTone(880, 0.15, 'square', 0.4), 180);
    },
    rest_start: () => {
        // Soft single tone (lower pitch)
        playGeneratedTone(440, 0.3, 'sine', 0.3);
    },
    countdown: () => {
        // Short pip
        playGeneratedTone(660, 0.08, 'sine', 0.25);
    },
    session_complete: () => {
        // Ascending success melody
        playGeneratedTone(523, 0.15, 'sine', 0.35); // C5
        setTimeout(() => playGeneratedTone(659, 0.15, 'sine', 0.35), 150); // E5
        setTimeout(() => playGeneratedTone(784, 0.25, 'sine', 0.35), 300); // G5
    },
    halfway: () => {
        // Soft chime
        playGeneratedTone(698, 0.2, 'sine', 0.25);
    },
    last_interval: () => {
        // Alert tone (two rising notes)
        playGeneratedTone(587, 0.12, 'triangle', 0.35);
        setTimeout(() => playGeneratedTone(784, 0.15, 'triangle', 0.35), 140);
    },
    steady_reminder: () => {
        // Gentle reminder (soft bell-like)
        playGeneratedTone(523, 0.3, 'sine', 0.2);
    },
};

/**
 * Play an audio cue
 * Tries to play from loaded buffer, falls back to generated tone
 */
export const playAudioCue = async (cue: AudioCue): Promise<void> => {
    // On native platforms, ensure audio context is active (may be suspended in background)
    if (Capacitor.isNativePlatform()) {
        await ensureAudioContextActive();
    } else {
        // Ensure audio context is initialized
        initAudioContext();
    }

    const buffer = audioBuffers.get(cue);

    if (buffer && audioContext) {
        // Play from loaded buffer
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start(0);
    } else {
        // Use fallback generated tone
        const fallback = FALLBACK_TONES[cue];
        if (fallback) {
            fallback();
        }
    }
};

/**
 * Play countdown sequence (3-2-1)
 */
export const playCountdownSequence = (onComplete?: () => void): void => {
    playAudioCue('countdown');
    setTimeout(() => playAudioCue('countdown'), 1000);
    setTimeout(() => playAudioCue('countdown'), 2000);
    if (onComplete) {
        setTimeout(onComplete, 3000);
    }
};

/**
 * Check if audio is supported and working
 */
export const isAudioSupported = (): boolean => {
    return !!(window.AudioContext || (window as any).webkitAudioContext);
};

/**
 * Get audio context state
 */
export const getAudioState = (): 'suspended' | 'running' | 'closed' | 'unavailable' => {
    if (!audioContext) return 'unavailable';
    // AudioContext.state can be 'suspended', 'running', 'closed', or 'interrupted' (iOS)
    // Map 'interrupted' to 'suspended' for our purposes
    const state = audioContext.state;
    if (state === 'suspended' || state === 'running' || state === 'closed') {
        return state;
    }
    return 'suspended'; // Treat 'interrupted' or any unknown state as suspended
};
