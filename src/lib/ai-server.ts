// Server-only AI functions with MCP support
// This file should only be imported in API routes (server-side)

import { GoogleGenAI, mcpToTool } from '@google/genai';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ChatMessage } from './ai';

interface MCPServerConfig {
    command: string;
    args?: string[];
    env?: Record<string, string>;
}

export interface MCPConfigDB {
    id: string;
    name: string;
    type: 'local' | 'cloud';
    config_json: string;
    enabled: boolean;
}

interface GenerateOptions {
    apiKey: string;
    model: string;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
}

export interface TrackedToolCall {
    toolName: string;
    toolInput: string;
    toolOutput: string;
    executionTimeMs: number;
    status: 'success' | 'error';
}

export interface ChatResult {
    response: string;
    thoughts: string | null;
    toolCalls: TrackedToolCall[];
}

// Active MCP clients cache
const activeClients: Map<string, Client> = new Map();

/**
 * Parse MCP config JSON string to MCPServerConfig
 */
function parseMCPConfig(configJson: string): MCPServerConfig | null {
    // Handle empty or null
    if (!configJson || configJson.trim() === '') {
        console.error('MCP config_json is empty');
        return null;
    }

    const cleanedJson = configJson.trim();

    try {
        const config = JSON.parse(cleanedJson);
        if (!config.command) {
            console.error('MCP config missing "command" field. Got:', config);
            return null;
        }
        return config as MCPServerConfig;
    } catch (error) {
        console.error('Error parsing MCP config JSON:', error);
        return null;
    }
}

/**
 * Connect to an MCP server and return client
 */
async function connectToMCP(config: MCPConfigDB): Promise<Client | null> {
    // Check cache first
    if (activeClients.has(config.id)) {
        return activeClients.get(config.id) || null;
    }

    const serverConfig = parseMCPConfig(config.config_json);
    if (!serverConfig) {
        return null;
    }

    try {
        const transport = new StdioClientTransport({
            command: serverConfig.command,
            args: serverConfig.args || [],
            env: serverConfig.env,
        });

        const client = new Client({
            name: 'ai-chat-agent',
            version: '1.0.0',
        });

        await client.connect(transport);
        activeClients.set(config.id, client);

        console.log(`Connected to MCP server: ${config.name}`);
        return client;
    } catch (error) {
        console.error(`Error connecting to MCP server ${config.name}:`, error);
        return null;
    }
}

/**
 * Disconnect MCP client
 */
export async function disconnectMCP(configId: string): Promise<void> {
    const client = activeClients.get(configId);
    if (client) {
        try {
            await client.close();
        } catch (error) {
            console.error('Error disconnecting MCP:', error);
        }
        activeClients.delete(configId);
    }
}

/**
 * Extract thoughts from Gemini response (for non-streaming mode)
 * Note: Thoughts are only reliably available in streaming mode
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractThoughts(response: any): string | null {
    try {
        const candidates = response.candidates;
        if (!candidates || candidates.length === 0) return null;

        const thoughts: string[] = [];

        for (const candidate of candidates) {
            if (candidate.content?.parts) {
                for (const part of candidate.content.parts) {
                    if (part.thought === true && typeof part.text === 'string') {
                        thoughts.push(part.text);
                    }
                }
            }
        }

        return thoughts.length > 0 ? thoughts.join('\n\n') : null;
    } catch (error) {
        console.error('Error extracting thoughts:', error);
        return null;
    }
}

/**
 * Call MCP tool with tracking
 */
async function callMCPToolWithTracking(
    client: Client,
    toolName: string,
    args: Record<string, unknown>,
    toolCalls: TrackedToolCall[]
): Promise<unknown> {
    const startTime = Date.now();
    let status: 'success' | 'error' = 'success';
    let result: unknown;

    try {
        result = await client.callTool({ name: toolName, arguments: args });
    } catch (error) {
        status = 'error';
        result = { error: String(error) };
    }

    const endTime = Date.now();

    toolCalls.push({
        toolName,
        toolInput: JSON.stringify(args),
        toolOutput: JSON.stringify(result),
        executionTimeMs: endTime - startTime,
        status,
    });

    console.log(`Tool call tracked: ${toolName} (${endTime - startTime}ms) - ${status}`);

    return result;
}

/**
 * Generate chat response with MCP tools integration and tracking
 * Returns both response and tracked tool calls
 */
export async function generateChatWithMCP(
    messages: ChatMessage[],
    options: GenerateOptions,
    mcpConfigs: MCPConfigDB[]
): Promise<ChatResult> {
    const { apiKey, model, systemPrompt, temperature = 0.7, maxTokens = 2048 } = options;

    const genAI = new GoogleGenAI({ apiKey });
    const toolCalls: TrackedToolCall[] = [];

    // Filter enabled configs only
    const enabledConfigs = mcpConfigs.filter((c) => c.enabled);

    // Build contents
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    // Add system instruction
    if (systemPrompt) {
        contents.push({
            role: 'user',
            parts: [{ text: `System Instructions: ${systemPrompt}\n\nPlease follow these instructions.` }],
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

    // If no MCP configs, do basic generation with thinking (using stream to capture thoughts)
    if (enabledConfigs.length === 0) {
        const stream = await genAI.models.generateContentStream({
            model: model,
            contents: contents,
            config: {
                temperature: temperature,
                maxOutputTokens: maxTokens,
                thinkingConfig: {
                    includeThoughts: true,
                    thinkingBudget: 8192,
                },
            },
        });

        // Collect response and thoughts from stream
        let responseText = '';
        const thoughtParts: string[] = [];

        for await (const chunk of stream) {
            if (chunk.candidates?.[0]?.content?.parts) {
                for (const part of chunk.candidates[0].content.parts) {
                    if (!part.text) continue;

                    if (part.thought === true) {
                        thoughtParts.push(part.text);
                    } else {
                        responseText += part.text;
                    }
                }
            }
        }

        const thoughts = thoughtParts.length > 0 ? thoughtParts.join('\n\n') : null;

        return {
            response: responseText || 'Sorry, I could not generate a response.',
            thoughts: thoughts,
            toolCalls: [],
        };
    }

    // Connect to MCP servers
    const mcpClients: Array<{ config: MCPConfigDB; client: Client }> = [];
    const mcpTools: ReturnType<typeof mcpToTool>[] = [];

    for (const config of enabledConfigs) {
        try {
            const client = await connectToMCP(config);
            if (client) {
                mcpClients.push({ config, client });
                mcpTools.push(mcpToTool(client));
                console.log(`Added MCP tools from: ${config.name}`);
            }
        } catch (error) {
            console.error(`Failed to connect to MCP server ${config.name}:`, error);
        }
    }

    try {
        // First generate to check if tool calls are needed
        const initialResponse = await genAI.models.generateContent({
            model: model,
            contents: contents,
            config: {
                temperature: temperature,
                maxOutputTokens: maxTokens,
                tools: mcpTools.length > 0 ? mcpTools : undefined,
            },
        });

        // Check if there are function calls in the response
        const candidate = initialResponse.candidates?.[0];
        let hasFunctionCalls = false;
        const functionCallsToExecute: Array<{ name: string; args: Record<string, unknown> }> = [];

        if (candidate?.content?.parts) {
            for (const part of candidate.content.parts) {
                if ('functionCall' in part && part.functionCall) {
                    hasFunctionCalls = true;
                    const fc = part.functionCall as { name: string; args?: Record<string, unknown> };
                    functionCallsToExecute.push({
                        name: fc.name,
                        args: fc.args || {},
                    });
                }
            }
        }

        // If no function calls, return the text response
        if (!hasFunctionCalls) {
            const thoughts = extractThoughts(initialResponse);
            return {
                response: initialResponse.text || 'Sorry, I could not generate a response.',
                thoughts: thoughts,
                toolCalls: [],
            };
        }

        // Execute function calls and track them
        const functionResponses: Array<{ name: string; response: unknown }> = [];

        for (const fc of functionCallsToExecute) {
            // Find the client that has this tool
            for (const { client } of mcpClients) {
                try {
                    const result = await callMCPToolWithTracking(
                        client,
                        fc.name,
                        fc.args,
                        toolCalls
                    );
                    functionResponses.push({ name: fc.name, response: result });
                    break; // Found the right client
                } catch {
                    // Try next client
                    continue;
                }
            }
        }

        // Build new contents with function results
        const contentsWithResults = [...contents];

        // Add the model's function call
        contentsWithResults.push({
            role: 'model',
            parts: functionCallsToExecute.map((fc) => ({
                text: `[Called tool: ${fc.name}]`,
            })),
        });

        // Add function results
        console.log("mcp response", functionResponses);

        contentsWithResults.push({
            role: 'user',
            parts: functionResponses.map((fr) => ({
                text: `[Tool result from ${fr.name}]: ${JSON.stringify(fr.response)}`,
            })),
        });

        // Generate final response with function results and thinking
        const finalResponse = await genAI.models.generateContent({
            model: model,
            contents: contentsWithResults,
            config: {
                temperature: temperature,
                maxOutputTokens: maxTokens,
                thinkingConfig: {
                    includeThoughts: true,
                    thinkingBudget: 8192,
                },
            },
        });

        const finalThoughts = extractThoughts(finalResponse);

        return {
            response: finalResponse.text || 'Sorry, I could not generate a response.',
            thoughts: finalThoughts,
            toolCalls,
        };
    } catch (error) {
        console.error('Error generating chat response with MCP:', error);

        // Fallback to basic generation if MCP fails
        console.log('Falling back to basic generation...');
        const fallbackResponse = await genAI.models.generateContent({
            model: model,
            contents: contents,
            config: {
                temperature: temperature,
                maxOutputTokens: maxTokens,
                thinkingConfig: {
                    includeThoughts: true,
                    thinkingBudget: 8192,
                },
            },
        });
        return {
            response: fallbackResponse.text || 'Sorry, I could not generate a response.',
            thoughts: extractThoughts(fallbackResponse),
            toolCalls,
        };
    }
}
