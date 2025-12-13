// Audio recording utility functions

/**
 * Format duration in seconds to MM:SS or HH:MM:SS
 */
export function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Check if browser supports audio recording
 */
export function isAudioRecordingSupported(): boolean {
    if (typeof window === 'undefined') return false;
    if (typeof navigator === 'undefined') return false;
    if (!navigator.mediaDevices) return false;
    if (!navigator.mediaDevices.getUserMedia) return false;
    if (!window.MediaRecorder) return false;
    return true;
}

/**
 * Get audio recording constraints
 */
export function getAudioConstraints(highQuality: boolean = true): MediaTrackConstraints {
    return {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: highQuality ? 48000 : 16000,
        channelCount: 1,
    };
}
