'use client';

import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3003';

// Socket.io event types
export interface RecordingStartedEvent {
    meetingId: string;
    segmentIndex: number;
    maxDuration: number;
}

export interface ChunkReceivedEvent {
    meetingId: string;
    segmentIndex: number;
    duration: number;
}

export interface RecordingStoppedEvent {
    meetingId: string;
    segmentIndex: number;
    duration: number;
    totalSegments: number;
}

export interface ProcessingProgressEvent {
    meetingId: string;
    stage: 'merging' | 'analyzing' | 'splitting' | 'transcribing' | 'finalizing';
    progress: number;
    message: string;
}

export interface ProcessingCompleteEvent {
    meetingId: string;
    success: boolean;
    segments: Array<{
        start: number;
        end: number;
        text: string;
        speaker: string | null;
    }>;
    fullText: string;
    speakers: string[];
    duration: number;
    audioUrl?: string;
    audioKey?: string;
    error?: string;
}

export interface MaxDurationReachedEvent {
    meetingId: string;
    duration: number;
}

// Singleton socket instance
let socket: Socket | null = null;
let connectionPromise: Promise<Socket> | null = null;

/**
 * Get or create socket connection
 */
export function getSocket(): Socket {
    if (!socket) {
        socket = io(SOCKET_URL, {
            autoConnect: false,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            timeout: 10000,
        });
    }
    return socket;
}

/**
 * Connect to socket server
 */
export async function connectSocket(): Promise<Socket> {
    const sock = getSocket();

    if (sock.connected) {
        return sock;
    }

    if (connectionPromise) {
        return connectionPromise;
    }

    connectionPromise = new Promise((resolve, reject) => {
        sock.connect();

        sock.once('connect', () => {
            console.log('[Socket] Connected to audio streaming server');
            connectionPromise = null;
            resolve(sock);
        });

        sock.once('connect_error', (error) => {
            console.error('[Socket] Connection error:', error);
            connectionPromise = null;
            reject(error);
        });
    });

    return connectionPromise;
}

/**
 * Disconnect socket
 */
export function disconnectSocket(): void {
    if (socket) {
        socket.disconnect();
        socket = null;
        connectionPromise = null;
    }
}

/**
 * Check if socket is currently connected
 */
export function isSocketConnected(): boolean {
    return socket?.connected ?? false;
}

/**
 * Subscribe to connection state changes
 */
export function onConnectionChange(callback: (connected: boolean) => void): () => void {
    const sock = getSocket();

    const handleConnect = () => callback(true);
    const handleDisconnect = () => callback(false);

    sock.on('connect', handleConnect);
    sock.on('disconnect', handleDisconnect);

    return () => {
        sock.off('connect', handleConnect);
        sock.off('disconnect', handleDisconnect);
    };
}

/**
 * Start recording a new segment
 */
export function startRecording(meetingId: string, maxDuration: number = 3600, title?: string, type: 'offline' | 'online' = 'offline'): void {
    const sock = getSocket();
    if (sock.connected) {
        sock.emit('start-recording', { meetingId, maxDuration, title, type });
    } else {
        console.error('[Socket] Not connected, cannot start recording');
    }
}

/**
 * Send audio chunk to server
 */
export function sendAudioChunk(meetingId: string, chunk: ArrayBuffer): void {
    const sock = getSocket();
    if (sock.connected) {
        sock.emit('audio-chunk', { meetingId, chunk });
    }
}

/**
 * Stop current recording segment
 */
export function stopRecording(meetingId: string): void {
    const sock = getSocket();
    if (sock.connected) {
        sock.emit('stop-recording', { meetingId });
    }
}

/**
 * Finish meeting and trigger processing
 */
export function finishMeeting(meetingId: string): void {
    const sock = getSocket();
    if (sock.connected) {
        sock.emit('finish-meeting', { meetingId });
    }
}

/**
 * Subscribe to socket events
 */
export function onRecordingStarted(callback: (event: RecordingStartedEvent) => void): () => void {
    const sock = getSocket();
    sock.on('recording-started', callback);
    return () => sock.off('recording-started', callback);
}

export function onChunkReceived(callback: (event: ChunkReceivedEvent) => void): () => void {
    const sock = getSocket();
    sock.on('chunk-received', callback);
    return () => sock.off('chunk-received', callback);
}

export function onRecordingStopped(callback: (event: RecordingStoppedEvent) => void): () => void {
    const sock = getSocket();
    sock.on('recording-stopped', callback);
    return () => sock.off('recording-stopped', callback);
}

export function onProcessingProgress(callback: (event: ProcessingProgressEvent) => void): () => void {
    const sock = getSocket();
    sock.on('processing-progress', callback);
    return () => sock.off('processing-progress', callback);
}

export function onProcessingComplete(callback: (event: ProcessingCompleteEvent) => void): () => void {
    const sock = getSocket();
    sock.on('processing-complete', callback);
    return () => sock.off('processing-complete', callback);
}

export function onProcessingError(callback: (event: { meetingId: string; error: string }) => void): () => void {
    const sock = getSocket();
    sock.on('processing-error', callback);
    return () => sock.off('processing-error', callback);
}

export function onMaxDurationReached(callback: (event: MaxDurationReachedEvent) => void): () => void {
    const sock = getSocket();
    sock.on('max-duration-reached', callback);
    return () => sock.off('max-duration-reached', callback);
}

export function onRecordingError(callback: (event: { meetingId: string; error: string }) => void): () => void {
    const sock = getSocket();
    sock.on('recording-error', callback);
    return () => sock.off('recording-error', callback);
}

export { Socket };
