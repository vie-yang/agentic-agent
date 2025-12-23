// Agentic AI Loop with Streaming Progress
// Enables AI to plan, reason, and execute multi-step tasks
// Uses manual tool handling for SDK compatibility

import { GoogleGenAI, FunctionDeclaration, Type } from '@google/genai';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ChatMessage } from './ai';

export interface AgenticConfig {
    apiKey: string;
    model: string;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
    maxIterations?: number;
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

export interface ToolCallRecord {
    toolName: string;
    toolInput: string;
    toolOutput: string;
    executionTimeMs: number;
    status: 'success' | 'error';
}

export interface AgenticStep {
    iteration: number;
    thoughts: string | null;
    response: string | null;
    toolCalls: ToolCallRecord[];
}

export interface AgenticResult {
    finalResponse: string;
    steps: AgenticStep[];
    totalIterations: number;
    allThoughts: string[];
    allToolCalls: ToolCallRecord[];
}

export type ProgressCallback = (update: {
    type: 'thinking' | 'tool_start' | 'tool_end' | 'response' | 'step_complete';
    iteration: number;
    content: string;
    toolName?: string;
    toolInput?: string;
    toolOutput?: string;
}) => void;

const activeClients: Map<string, Client> = new Map();

interface MCPServerConfig {
    command: string;
    args?: string[];
    env?: Record<string, string>;
}

function parseMCPConfig(configJson: string): MCPServerConfig | null {
    if (!configJson || configJson.trim() === '') return null;
    try {
        const config = JSON.parse(configJson.trim());
        if (!config.command) return null;
        return config as MCPServerConfig;
    } catch {
        return null;
    }
}

async function connectToMCP(config: MCPConfigDB): Promise<Client | null> {
    if (activeClients.has(config.id)) {
        return activeClients.get(config.id) || null;
    }

    const serverConfig = parseMCPConfig(config.config_json);
    if (!serverConfig) return null;

    try {
        const transport = new StdioClientTransport({
            command: serverConfig.command,
            args: serverConfig.args || [],
            env: serverConfig.env,
        });

        const client = new Client({
            name: 'ai-chat-agent-agentic',
            version: '1.0.0',
        });

        await client.connect(transport);
        activeClients.set(config.id, client);
        return client;
    } catch (error) {
        console.error(`Error connecting to MCP server ${config.name}:`, error);
        return null;
    }
}

/**
 * Convert MCP tool schema to Gemini FunctionDeclaration
 */
function mcpSchemaToGemini(tool: { name: string; description?: string; inputSchema?: unknown }): FunctionDeclaration {
    const schema = tool.inputSchema as { properties?: Record<string, unknown>; required?: string[] } | undefined;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parameters: any = {
        type: Type.OBJECT,
        properties: {},
        required: schema?.required || [],
    };

    if (schema?.properties) {
        for (const [key, value] of Object.entries(schema.properties)) {
            const prop = value as { type?: string; description?: string; items?: { type?: string } };

            // Build the property schema
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const propSchema: any = {
                description: prop.description || key,
            };

            // Handle different types
            if (prop.type === 'array') {
                propSchema.type = Type.ARRAY;
                // Array requires items definition
                propSchema.items = {
                    type: prop.items?.type === 'number' ? Type.NUMBER :
                        prop.items?.type === 'boolean' ? Type.BOOLEAN :
                            Type.STRING, // Default to string items
                };
            } else if (prop.type === 'number' || prop.type === 'integer') {
                propSchema.type = Type.NUMBER;
            } else if (prop.type === 'boolean') {
                propSchema.type = Type.BOOLEAN;
            } else if (prop.type === 'object') {
                propSchema.type = Type.OBJECT;
                propSchema.properties = {};
            } else {
                propSchema.type = Type.STRING;
            }

            parameters.properties[key] = propSchema;
        }
    }

    return {
        name: tool.name,
        description: tool.description || tool.name,
        parameters: parameters,
    };
}

const AGENTIC_SYSTEM_PROMPT = `You are an AI agent with planning and reasoning capabilities. When given a task:

1. **Plan**: Break down the task into clear, actionable steps
2. **Execute**: Use available tools to complete each step
3. **Reason**: Analyze results and adjust your approach if needed
4. **Report**: Provide status updates and explain your actions

Guidelines:
- Always think step-by-step before taking action
- Use tools when you need external information or capabilities
- If a step fails, try alternative approaches
- Signal completion by providing a comprehensive final answer
- Be concise but thorough in your responses

**Data Visualization Capabilities:**
You can generate interactive charts to visualize data when appropriate (e.g., comparing numbers, showing trends, or displaying parts of a whole).

Use the 'generate_chart' tool to create:
- **Bar Charts**: Best for comparing distinct categories.
- **Line Charts**: Best for showing trends over time or continuous data.
- **Pie Charts**: Best for showing proportions or percentages of a total.
- **Area Charts**: Best for showing cumulative totals or changes over time with emphasis on volume.

When using 'generate_chart':
1. Provide a clear 'title' for the chart.
2. Structure the 'data' as an array of objects where each object has a common label (e.g., 'name', 'month', 'category') and one or more numeric values.
3. Choose the most appropriate 'type' for the visualization.
4. **Dynamic Colors**: If a chart needs multi-color representation (especially for **Pie Charts**), you can provide a 'colors' array with contrasting but soft hex colors (e.g., Emerald, Amber, Violet). This ensures segments are clearly distinguishable while maintaining a premium aesthetic.

When user asks for data analysis, ALWAYS consider if a chart would make the information clearer than just text or a table.

When your task is COMPLETE, end your response with: [TASK_COMPLETE]`;

/**
 * Execute agentic loop with manual tool handling for SDK compatibility
 */
export async function executeAgenticLoop(
    messages: ChatMessage[],
    config: AgenticConfig,
    mcpConfigs: MCPConfigDB[],
    onProgress?: ProgressCallback,
    fileSearchStore?: FileSearchStoreDB | null
): Promise<AgenticResult> {
    const {
        apiKey,
        model,
        systemPrompt,
        temperature = 0.7,
        maxTokens = 4096,
        maxIterations = 10,
    } = config;

    const genAI = new GoogleGenAI({ apiKey });
    const steps: AgenticStep[] = [];
    const allThoughts: string[] = [];
    const allToolCalls: ToolCallRecord[] = [];

    // Connect to MCP servers and get tool definitions
    const mcpClients: Array<{ config: MCPConfigDB; client: Client }> = [];
    const toolDeclarations: FunctionDeclaration[] = [];

    for (const mcpConfig of mcpConfigs.filter((c) => c.enabled)) {
        try {
            const client = await connectToMCP(mcpConfig);
            if (client) {
                mcpClients.push({ config: mcpConfig, client });

                // Get tool list from MCP server
                const toolsResult = await client.listTools();
                if (toolsResult.tools) {
                    for (const tool of toolsResult.tools) {
                        toolDeclarations.push(mcpSchemaToGemini(tool));
                        console.log(`Registered tool: ${tool.name}`);
                    }
                }
            }
        } catch (error) {
            console.error(`Failed to connect to MCP ${mcpConfig.name}:`, error);
        }
    }

    // Add built-in resource tools if we have MCP clients
    if (mcpClients.length > 0) {
        // Tool to list available resources
        toolDeclarations.push({
            name: 'list_mcp_resources',
            description: 'List all available resources from connected MCP servers. Use this to discover what data/context is available.',
            parameters: {
                type: Type.OBJECT,
                properties: {},
                required: [],
            },
        });

        // Tool to read a specific resource
        toolDeclarations.push({
            name: 'read_mcp_resource',
            description: 'Read the content of a specific MCP resource by its URI. First use list_mcp_resources to find available resources.',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    uri: {
                        type: Type.STRING,
                        description: 'The URI of the resource to read (e.g., "resource://database-schema")',
                    },
                },
                required: ['uri'],
            },
        });
        console.log('Added built-in resource tools: list_mcp_resources, read_mcp_resource');
    }

    // Add built-in export tools (always available)
    toolDeclarations.push({
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
    });

    toolDeclarations.push({
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
    });
    toolDeclarations.push({
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
    });

    console.log('Added built-in export tools: export_to_pdf, export_to_excel, generate_chart');

    // Build conversation history
    const combinedSystemPrompt = systemPrompt
        ? `${systemPrompt}\n\n${AGENTIC_SYSTEM_PROMPT}`
        : AGENTIC_SYSTEM_PROMPT;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let contents: any[] = [];

    if (combinedSystemPrompt) {
        contents.push({
            role: 'user',
            parts: [{ text: `System Instructions: ${combinedSystemPrompt}\n\nPlease follow these instructions.` }],
        });
        contents.push({
            role: 'model',
            parts: [{ text: 'I understand and will follow these instructions.' }],
        });
    }

    for (const msg of messages) {
        contents.push({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }],
        });
    }

    console.log('=== AGENTIC LOOP STARTED ===');
    console.log(`Model: ${model}, Max Iterations: ${maxIterations}`);
    console.log(`Tools available: ${toolDeclarations.length}`);
    console.log(`Messages: ${messages.length}`);
    
    // Log file search store status
    if (fileSearchStore?.enabled && fileSearchStore?.store_name) {
        console.log(`[FileSearch] Agentic mode: File Search Store enabled`);
        console.log(`[FileSearch] Store Name: ${fileSearchStore.store_name}`);
        console.log(`[FileSearch] Display Name: ${fileSearchStore.display_name}`);
    } else {
        console.log(`[FileSearch] Agentic mode: No File Search Store configured`);
    }

    let iteration = 0;
    let taskComplete = false;
    let finalResponse = '';

    while (iteration < maxIterations && !taskComplete) {
        iteration++;

        const currentStep: AgenticStep = {
            iteration,
            thoughts: null,
            response: null,
            toolCalls: [],
        };

        onProgress?.({
            type: 'thinking',
            iteration,
            content: `Iteration ${iteration}: AI is thinking...`,
        });

        try {
            // Generate with streaming and thinkingConfig
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
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    tools: (() => {
                        const allTools: any[] = [];
                        // MCP function declarations
                        if (toolDeclarations.length > 0) {
                            allTools.push({
                                functionDeclarations: toolDeclarations,
                            });
                        }
                        // File Search tool for RAG
                        if (fileSearchStore?.enabled && fileSearchStore?.store_name) {
                            allTools.push({
                                fileSearch: {
                                    fileSearchStoreNames: [fileSearchStore.store_name],
                                },
                            });
                        }
                        return allTools.length > 0 ? allTools : undefined;
                    })(),
                },
            });

            let responseText = '';
            const thoughtParts: string[] = [];
            // Store all parts to preserve context (text, thoughts, tool calls)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const modelTurnParts: any[] = [];
            const functionCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

            for await (const chunk of stream) {
                console.log(`Chunk received in iteration ${iteration}`);
                
                // Log grounding metadata for file search (RAG)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const candidate = chunk.candidates?.[0] as any;
                if (candidate?.groundingMetadata) {
                    console.log(`[FileSearch] Agentic mode: Grounding metadata detected in iteration ${iteration}`);
                    if (candidate.groundingMetadata.groundingChunks) {
                        console.log(`[FileSearch] Retrieved ${candidate.groundingMetadata.groundingChunks.length} chunks from file store`);
                        for (const grndChunk of candidate.groundingMetadata.groundingChunks) {
                            if (grndChunk.retrievedContext?.uri) {
                                console.log(`[FileSearch] Source: ${grndChunk.retrievedContext.uri}`);
                            }
                            if (grndChunk.retrievedContext?.title) {
                                console.log(`[FileSearch] Document: ${grndChunk.retrievedContext.title}`);
                            }
                        }
                    }
                    if (candidate.groundingMetadata.groundingSupports) {
                        console.log(`[FileSearch] Found ${candidate.groundingMetadata.groundingSupports.length} grounding supports`);
                    }
                }
                
                if (chunk.candidates?.[0]?.content?.parts) {
                    for (const part of chunk.candidates[0].content.parts) {
                        const partKeys = Object.keys(part);
                        console.log(`Part type: ${partKeys.join(', ')}`);

                        // Collect all parts for conversation history
                        modelTurnParts.push(part);

                        if (part.thought === true && part.text) {
                            thoughtParts.push(part.text);
                            onProgress?.({
                                type: 'thinking',
                                iteration,
                                content: part.text,
                            });
                        } else if ('functionCall' in part && part.functionCall) {
                            const fc = part.functionCall as { name: string; args?: Record<string, unknown> };
                            functionCalls.push({
                                name: fc.name,
                                args: fc.args || {},
                            });
                            console.log(`Function call detected: ${fc.name}, has thoughtSignature: ${'thoughtSignature' in part}`);
                        } else if (part.text && !part.thought) {
                            responseText += part.text;
                            console.log(`Text part received: ${part.text.substring(0, 50)}...`);
                        }
                    }
                }
            }

            console.log(`Iteration ${iteration}: thoughts=${thoughtParts.length}, responseText=${responseText.length} chars, functionCalls=${functionCalls.length}`);

            // Save thoughts
            if (thoughtParts.length > 0) {
                currentStep.thoughts = thoughtParts.join('\n\n');
                allThoughts.push(...thoughtParts);
            }

            // Execute function calls manually
            if (functionCalls.length > 0) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const functionResponseParts: any[] = [];

                for (const fc of functionCalls) {
                    onProgress?.({
                        type: 'tool_start',
                        iteration,
                        content: `Calling tool: ${fc.name}`,
                        toolName: fc.name,
                    });

                    const startTime = Date.now();
                    let toolResult: unknown;
                    let status: 'success' | 'error' = 'success';

                    // Handle built-in resource tools
                    if (fc.name === 'list_mcp_resources') {
                        try {
                            const allResources: Array<{ uri: string; name: string; description?: string; mimeType?: string }> = [];
                            for (const { config, client } of mcpClients) {
                                const resourcesResult = await client.listResources();
                                if (resourcesResult.resources) {
                                    for (const resource of resourcesResult.resources) {
                                        allResources.push({
                                            uri: resource.uri,
                                            name: resource.name,
                                            description: resource.description,
                                            mimeType: resource.mimeType,
                                        });
                                    }
                                }
                                console.log(`Listed ${resourcesResult.resources?.length || 0} resources from ${config.name}`);
                            }
                            toolResult = { resources: allResources };
                        } catch (err) {
                            status = 'error';
                            toolResult = { error: `Failed to list resources: ${err}` };
                        }
                    } else if (fc.name === 'read_mcp_resource') {
                        const uri = fc.args.uri as string;
                        try {
                            let found = false;
                            for (const { client } of mcpClients) {
                                try {
                                    const resourceContent = await client.readResource({ uri });
                                    toolResult = {
                                        uri,
                                        contents: resourceContent.contents.map(c => ({
                                            type: 'uri' in c ? 'resource' : 'text',
                                            text: 'text' in c ? c.text : JSON.stringify(c),
                                        })),
                                    };
                                    found = true;
                                    break;
                                } catch {
                                    continue;
                                }
                            }
                            if (!found) {
                                status = 'error';
                                toolResult = { error: `Resource not found: ${uri}` };
                            }
                        } catch (err) {
                            status = 'error';
                            toolResult = { error: `Failed to read resource: ${err}` };
                        }
                    } else if (fc.name === 'export_to_pdf' || fc.name === 'export_to_excel') {
                        // Handle built-in export tools
                        const exportType = fc.name === 'export_to_pdf' ? 'pdf' : 'excel';
                        const content = fc.args.content as string;
                        const title = fc.args.title as string | undefined;
                        const filename = fc.args.filename as string | undefined;

                        console.log(`[Export] Executing ${fc.name} tool...`);

                        try {
                            // Get base URL
                            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
                            
                            // Call export API
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

                            const result = await response.json();
                            console.log(`[Export] Generated ${exportType.toUpperCase()}: ${result.downloadUrl}`);
                            
                            toolResult = {
                                success: true,
                                downloadUrl: result.downloadUrl,
                                filename: result.filename,
                                message: `File exported successfully. Download: ${result.downloadUrl}`,
                            };
                        } catch (err) {
                            status = 'error';
                            console.error(`[Export] Error:`, err);
                            toolResult = { error: `Failed to export: ${err}` };
                        }
                    } else if (fc.name === 'generate_chart') {
                        // Built-in tool handled by frontend
                        console.log(`[Chart] Handled built-in tool: ${fc.name}`);
                        toolResult = {
                            success: true,
                            message: 'Chart generated and displayed to user.',
                        };
                    } else {
                        // Find the right MCP client and call the tool
                        for (const { client } of mcpClients) {
                            try {
                                toolResult = await client.callTool({
                                    name: fc.name,
                                    arguments: fc.args,
                                });
                                break;
                            } catch (err) {
                                console.log(`Tool call error: ${err}`);
                                continue;
                            }
                        }

                        if (!toolResult) {
                            status = 'error';
                            toolResult = { error: 'Tool not found or execution failed' };
                        }
                    }

                    const endTime = Date.now();

                    // Extract text from MCP response format
                    let resultText = '';
                    const mcpResult = toolResult as { content?: Array<{ type: string; text: string }>; error?: unknown };
                    if (mcpResult.content) {
                        resultText = mcpResult.content.map(c => c.text).join('\n');
                    } else if (mcpResult.error) {
                        status = 'error';
                        resultText = JSON.stringify(mcpResult.error);
                    } else {
                        resultText = JSON.stringify(toolResult);
                    }

                    const toolRecord: ToolCallRecord = {
                        toolName: fc.name,
                        toolInput: JSON.stringify(fc.args, null, 2),
                        toolOutput: resultText,
                        executionTimeMs: endTime - startTime,
                        status,
                    };

                    currentStep.toolCalls.push(toolRecord);
                    allToolCalls.push(toolRecord);

                    onProgress?.({
                        type: 'tool_end',
                        iteration,
                        content: `Tool ${fc.name} completed (${toolRecord.executionTimeMs}ms)`,
                        toolName: fc.name,
                        toolInput: toolRecord.toolInput,
                        toolOutput: toolRecord.toolOutput,
                    });

                    // Prepare function response for next iteration
                    functionResponseParts.push({
                        functionResponse: {
                            name: fc.name,
                            response: { result: resultText },
                        },
                    });
                }

                // Add full model response and tool results to conversation for next iteration
                // Using modelTurnParts preserves text, thoughts, and function calls correctly
                contents.push({
                    role: 'model',
                    parts: modelTurnParts,
                });

                contents.push({
                    role: 'user',
                    parts: functionResponseParts,
                });

                // Continue to next iteration to get response after tool execution
            } else {
                // No function calls - this is a text response
                currentStep.response = responseText;
                finalResponse = responseText;

                onProgress?.({
                    type: 'response',
                    iteration,
                    content: responseText,
                });

                // Check for task completion
                if (responseText.includes('[TASK_COMPLETE]')) {
                    taskComplete = true;
                    finalResponse = responseText.replace('[TASK_COMPLETE]', '').trim();
                    console.log('Task complete signal detected!');
                } else if (responseText.length > 0) {
                    // Has response without explicit completion - assume done
                    taskComplete = true;
                }
            }

            steps.push(currentStep);

            onProgress?.({
                type: 'step_complete',
                iteration,
                content: `Step ${iteration} complete`,
            });

        } catch (error) {
            console.error(`Error in iteration ${iteration}:`, error);
            steps.push({
                ...currentStep,
                response: `Error in iteration ${iteration}: ${error}`,
            });
            break;
        }
    }

    console.log('=== AGENTIC LOOP COMPLETE ===');
    console.log(`Total iterations: ${iteration}, finalResponse length: ${finalResponse.length}`);
    console.log(`Total thoughts: ${allThoughts.length}, Total toolCalls: ${allToolCalls.length}`);

    return {
        finalResponse: finalResponse || 'Unable to complete the task.',
        steps,
        totalIterations: iteration,
        allThoughts,
        allToolCalls,
    };
}
