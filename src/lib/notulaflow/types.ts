// Meeting and recording type definitions for Notula Flow

export interface Bookmark {
    id: string;
    timestamp: number; // in seconds
    type: 'important' | 'action_item';
    createdAt: Date;
}

export interface Meeting {
    id: string;
    title: string;
    createdAt: Date;
    updatedAt: Date;
    duration: number; // in seconds
    status: 'active' | 'recording' | 'processing' | 'transcribing' | 'summarizing' | 'completed' | 'error';
    audioUrl?: string;
    bookmarks: Bookmark[];
    transcript?: Transcript;
    summary?: MeetingSummary;
    errorMessage?: string;
}

export interface TranscriptSegment {
    id: string;
    start: number; // in seconds
    end: number;
    text: string;
    speaker?: string;
    confidence?: number;
}

export interface Transcript {
    segments: TranscriptSegment[];
    fullText: string;
    language?: string;
    speakers: string[];
}

export interface ActionItem {
    id: string;
    task: string;
    assignee?: string;
    deadline?: string;
    completed: boolean;
    sourceTimestamp?: number;
}

export interface KeyDecision {
    id: string;
    decision: string;
    context?: string;
    sourceTimestamp?: number;
}

export interface TopicSegment {
    id: string;
    topic: string;
    startTime: number;
    endTime: number;
    sentiment?: 'positive' | 'neutral' | 'negative' | 'tense' | 'enthusiastic';
}

export interface MeetingSummary {
    executiveSummary: string;
    keyDecisions: KeyDecision[];
    actionItems: ActionItem[];
    topics: TopicSegment[];
    overallSentiment: string;
    generatedAt: Date;
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    sourceReferences?: {
        timestamp: number;
        text: string;
    }[];
}

// API Response types
export interface TranscriptionResponse {
    success: boolean;
    transcript?: Transcript;
    error?: string;
}

export interface SummarizationResponse {
    success: boolean;
    summary?: MeetingSummary;
    error?: string;
}

export interface ChatResponse {
    success: boolean;
    message?: ChatMessage;
    error?: string;
}

// Audio chunk for processing
export interface AudioChunk {
    id: string;
    index: number;
    blob: Blob;
    startTime: number;
    endTime: number;
    duration: number;
}
