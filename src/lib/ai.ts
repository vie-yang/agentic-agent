import { GoogleGenAI } from '@google/genai';

// Available Gemini models
export const GEMINI_MODELS = [
    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro', description: 'Latest and greatest model' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast and efficient for most tasks' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Advanced reasoning and analysis' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Fast and efficient for most tasks' },
] as const;

export type GeminiModelId = typeof GEMINI_MODELS[number]['id'];

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

interface GenerateOptions {
    apiKey: string;
    model: string;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
}

/**
 * Generate chat response using Google Gemini
 * Basic version without MCP - for client-safe imports
 */
export async function generateChatResponse(
    messages: ChatMessage[],
    options: GenerateOptions
): Promise<string> {
    const { apiKey, model, systemPrompt, temperature = 0.7, maxTokens = 2048 } = options;

    const genAI = new GoogleGenAI({ apiKey });

    // Build contents for Gemini API
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    // Add system instruction if provided
    if (systemPrompt) {
        contents.push({
            role: 'user',
            parts: [{ text: `System Instructions: ${systemPrompt}\n\nPlease follow these instructions for all responses.` }],
        });
        contents.push({
            role: 'model',
            parts: [{ text: 'I understand and will follow these instructions.' }],
        });
    }

    // Add conversation history
    for (const msg of messages) {
        contents.push({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }],
        });
    }

    try {
        const response = await genAI.models.generateContent({
            model: model,
            contents: contents,
            config: {
                temperature: temperature,
                maxOutputTokens: maxTokens,
            },
        });

        return response.text || 'Sorry, I could not generate a response.';
    } catch (error) {
        console.error('Error generating chat response:', error);
        throw new Error('Failed to generate response from AI');
    }
}

// Validate API key by making a simple request
export async function validateApiKey(apiKey: string): Promise<boolean> {
    try {
        const genAI = new GoogleGenAI({ apiKey });
        await genAI.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: 'Hello',
            config: { maxOutputTokens: 10 },
        });
        return true;
    } catch {
        return false;
    }
}
