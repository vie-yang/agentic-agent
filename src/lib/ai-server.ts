// Server-only AI functions with MCP support
// This file should only be imported in API routes (server-side)

import { GoogleGenAI, mcpToTool, Type, FunctionDeclaration } from '@google/genai';
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

export interface FileSearchStoreDB {
    id: string;
    agent_id: string;
    store_name: string;
    display_name: string;
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
 * Built-in export tool function declarations
 */
function getExportToolDeclarations(): FunctionDeclaration[] {
    return [
        {
            name: 'export_to_pdf',
            description: 'Export markdown content to a formatted PDF file. Use when user wants to download, save, or export text/report content. Returns a download URL.',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    content: {
                        type: Type.STRING,
                        description: 'The markdown content to export to PDF. Include proper formatting with headers, bullets, etc.',
                    },
                    title: {
                        type: Type.STRING,
                        description: 'Title for the PDF document',
                    },
                    filename: {
                        type: Type.STRING,
                        description: 'Base filename for the PDF (without extension)',
                    },
                },
                required: ['content'],
            },
        },
        {
            name: 'export_to_excel',
            description: 'Export tabular data to an Excel file. Use when user wants to export tables, lists, or structured data. Data should be JSON array of objects. Returns a download URL.',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    content: {
                        type: Type.STRING,
                        description: 'JSON string of data to export. Must be an array of objects with consistent keys, OR a markdown table.',
                    },
                    title: {
                        type: Type.STRING,
                        description: 'Title/sheet name for the Excel file',
                    },
                    filename: {
                        type: Type.STRING,
                        description: 'Base filename for the Excel file (without extension)',
                    },
                },
                required: ['content'],
            },
        },
        {
            name: 'generate_chart',
            description: 'Generate an interactive chart (Bar, Line, Pie, Area) to visualize data. Use this when the user asks for a graph, chart, or visual representation of data.',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    type: {
                        type: Type.STRING,
                        description: 'The type of chart to generate: "bar", "line", "pie", or "area".',
                    },
                    title: {
                        type: Type.STRING,
                        description: 'The title of the chart.',
                    },
                    data: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                        },
                        description: 'The data to visualize. An array of objects, e.g., [{"name": "Jan", "value": 100}, {"name": "Feb", "value": 200}].',
                    },
                    xAxisKey: {
                        type: Type.STRING,
                        description: 'The key in the data objects to use for the X-axis (e.g., "name", "label", "month"). Required for bar, line, and area charts.',
                    },
                    yAxisKey: {
                        type: Type.STRING,
                        description: 'The key in the data objects to use for the Y-axis value (e.g., "value", "amount").',
                    },
                    colors: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.STRING,
                        },
                        description: 'Optional array of hex colors to use for the chart. Recommended for Pie charts to ensure contrast (soft, premium colors).',
                    },
                },
                required: ['type', 'title', 'data', 'xAxisKey', 'yAxisKey'],
            },
        },
    ];
}

/**
 * Execute export tool and return result
 */
async function executeExportTool(
    toolName: string,
    args: Record<string, unknown>,
    toolCalls: TrackedToolCall[]
): Promise<{ result: unknown; resultText: string }> {
    const startTime = Date.now();
    let status: 'success' | 'error' = 'success';
    let result: unknown;
    let resultText = '';

    const exportType = toolName === 'export_to_pdf' ? 'pdf' : 'excel';
    const content = args.content as string;
    const title = args.title as string | undefined;
    const filename = args.filename as string | undefined;

    console.log(`[Export] Simple mode: Executing ${toolName} tool...`);

    try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        
        const response = await fetch(`${baseUrl}/api/agents/export`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: exportType,
                content,
                title,
                filename,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Export failed');
        }

        const exportResult = await response.json();
        console.log(`[Export] Simple mode: Generated ${exportType.toUpperCase()}: ${exportResult.downloadUrl}`);
        
        result = {
            success: true,
            downloadUrl: exportResult.downloadUrl,
            filename: exportResult.filename,
            message: `File exported successfully. Download: ${exportResult.downloadUrl}`,
        };
        resultText = JSON.stringify(result);
    } catch (err) {
        status = 'error';
        console.error(`[Export] Simple mode error:`, err);
        result = { error: `Failed to export: ${err}` };
        resultText = JSON.stringify(result);
    }

    const endTime = Date.now();

    toolCalls.push({
        toolName,
        toolInput: JSON.stringify(args),
        toolOutput: resultText,
        executionTimeMs: endTime - startTime,
        status,
    });

    return { result, resultText };
}

/**
 * Generate chat response with MCP tools integration and tracking
 * Now supports File Search for RAG capabilities
 * Returns both response and tracked tool calls
 */
export async function generateChatWithMCP(
    messages: ChatMessage[],
    options: GenerateOptions,
    mcpConfigs: MCPConfigDB[],
    fileSearchStore?: FileSearchStoreDB | null
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

    // Log file search store status
    if (fileSearchStore?.enabled && fileSearchStore?.store_name) {
        console.log(`[FileSearch] Simple mode: File Search Store enabled`);
        console.log(`[FileSearch] Store Name: ${fileSearchStore.store_name}`);
        console.log(`[FileSearch] Display Name: ${fileSearchStore.display_name}`);
    } else {
        console.log(`[FileSearch] Simple mode: No File Search Store configured`);
    }

    // Build file search tool config if available
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fileSearchTool: any = fileSearchStore?.enabled && fileSearchStore?.store_name
        ? { fileSearch: { fileSearchStoreNames: [fileSearchStore.store_name] } }
        : null;

    // If no MCP configs, do basic generation with thinking (using stream to capture thoughts)
    if (enabledConfigs.length === 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tools: any[] = [];
        
        // Add export tools (always available)
        tools.push({ functionDeclarations: getExportToolDeclarations() });
        console.log(`[Export] Added export tools to simple generation`);
        
        if (fileSearchTool) {
            tools.push(fileSearchTool);
            console.log(`[FileSearch] Adding File Search tool to simple generation`);
        }

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
                tools: tools.length > 0 ? tools : undefined,
            },
        });

        // Collect response, thoughts, and function calls from stream
        let responseText = '';
        const thoughtParts: string[] = [];
        let fileSearchUsed = false;
        const functionCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

        for await (const chunk of stream) {
            // Log grounding metadata for file search
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const candidate = chunk.candidates?.[0] as any;
            if (candidate?.groundingMetadata) {
                fileSearchUsed = true;
                console.log(`[FileSearch] Grounding metadata detected in simple mode`);
                if (candidate.groundingMetadata.groundingChunks) {
                    console.log(`[FileSearch] Retrieved ${candidate.groundingMetadata.groundingChunks.length} chunks from file store`);
                    for (const grndChunk of candidate.groundingMetadata.groundingChunks) {
                        if (grndChunk.retrievedContext?.uri) {
                            console.log(`[FileSearch] Source: ${grndChunk.retrievedContext.uri}`);
                        }
                    }
                }
                if (candidate.groundingMetadata.groundingSupports) {
                    console.log(`[FileSearch] Found ${candidate.groundingMetadata.groundingSupports.length} grounding supports`);
                }
            }

            if (chunk.candidates?.[0]?.content?.parts) {
                for (const part of chunk.candidates[0].content.parts) {
                    // Check for function call
                    if ('functionCall' in part && part.functionCall) {
                        const fc = part.functionCall as { name: string; args?: Record<string, unknown> };
                        functionCalls.push({
                            name: fc.name,
                            args: fc.args || {},
                        });
                        console.log(`[Export] Simple mode: Function call detected: ${fc.name}`);
                    } else if (part.text) {
                        if (part.thought === true) {
                            thoughtParts.push(part.text);
                        } else {
                            responseText += part.text;
                        }
                    }
                }
            }
        }

        if (fileSearchTool && !fileSearchUsed) {
            console.log(`[FileSearch] File Search was enabled but no retrieval occurred (query may not have matched any documents)`);
        }

        const thoughts = thoughtParts.length > 0 ? thoughtParts.join('\n\n') : null;

        // Handle export function calls
        if (functionCalls.length > 0) {
            const exportToolCalls: TrackedToolCall[] = [];
            const exportResults: string[] = [];

            for (const fc of functionCalls) {
                if (fc.name === 'export_to_pdf' || fc.name === 'export_to_excel') {
                    const { resultText } = await executeExportTool(fc.name, fc.args, exportToolCalls);
                    const resultObj = JSON.parse(resultText);
                    if (resultObj.downloadUrl) {
                        exportResults.push(`📥 **Download**: [${resultObj.filename}](${resultObj.downloadUrl})`);
                    }
                } else if (fc.name === 'generate_chart') {
                    // Manual chart handling for non-agentic mode if needed
                    // For now, we'll just track it and let the frontend handle the tool call
                    toolCalls.push({
                        toolName: fc.name,
                        toolInput: JSON.stringify(fc.args),
                        toolOutput: JSON.stringify({ success: true }),
                        executionTimeMs: 0,
                        status: 'success',
                    });
                }
            }

            // Append download links to response
            if (exportResults.length > 0) {
                responseText = responseText + '\n\n' + exportResults.join('\n');
            }

            // Merge export tool calls into the main tracking array
            toolCalls.push(...exportToolCalls);

            return {
                response: responseText || 'Sorry, I could not generate a response.',
                thoughts,
                toolCalls: toolCalls,
            };
        }

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
        // Build all tools (MCP + File Search + Export)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const allTools: any[] = [...mcpTools];
        
        // Add export tools
        allTools.push({ functionDeclarations: getExportToolDeclarations() });
        console.log(`[Export] Added export tools to MCP mode`);
        
        if (fileSearchTool) {
            allTools.push(fileSearchTool);
            console.log(`[FileSearch] Adding File Search tool alongside MCP tools`);
        }

        // First generate to check if tool calls are needed
        const initialResponse = await genAI.models.generateContent({
            model: model,
            contents: contents,
            config: {
                temperature: temperature,
                maxOutputTokens: maxTokens,
                tools: allTools.length > 0 ? allTools : undefined,
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
