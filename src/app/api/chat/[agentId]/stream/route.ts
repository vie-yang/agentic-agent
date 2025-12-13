import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { executeAgenticLoop, MCPConfigDB, AgenticConfig } from '@/lib/agentic-loop';
import { ChatMessage } from '@/lib/ai';
import { v4 as uuidv4 } from 'uuid';

interface Agent {
    id: string;
    name: string;
    system_prompt: string | null;
}

interface LLMConfig {
    model: string;
    temperature: number;
    max_tokens: number;
    agent_mode: 'simple' | 'agentic';
    max_iterations: number;
}

interface APIKey {
    api_key: string;
}

interface StreamRequestBody {
    messages: ChatMessage[];
    sessionId?: string;
    clientName?: string;
    clientLevel?: string;
}

// Helper to save chat session and messages
async function saveSessionAndMessages(
    agentId: string,
    sessionId: string,
    userMessage: ChatMessage,
    assistantMessage: string,
    thoughts: string | null,
    toolCalls: Array<{
        toolName: string;
        toolInput: string;
        toolOutput: string;
        executionTimeMs: number;
        status: 'success' | 'error';
    }>,
    isNewSession: boolean,
    clientName?: string,
    clientLevel?: string
): Promise<void> {
    // Create session if new
    if (isNewSession) {
        await query(
            `INSERT INTO chat_sessions (id, agent_id, session_source, client_name, client_level, message_count, tool_call_count)
       VALUES (?, ?, 'widget', ?, ?, 0, 0)`,
            [sessionId, agentId, clientName || null, clientLevel || null]
        );
    }

    // Save user message
    const userMessageId = uuidv4();
    await query(
        `INSERT INTO chat_messages (id, session_id, role, content) VALUES (?, ?, 'user', ?)`,
        [userMessageId, sessionId, userMessage.content]
    );

    // Save assistant message with thoughts
    const assistantMessageId = uuidv4();
    await query(
        `INSERT INTO chat_messages (id, session_id, role, content, thoughts) VALUES (?, ?, 'assistant', ?, ?)`,
        [assistantMessageId, sessionId, assistantMessage, thoughts]
    );

    // Save tool calls
    for (const tc of toolCalls) {
        const toolCallId = uuidv4();
        await query(
            `INSERT INTO tool_calls (id, message_id, session_id, tool_name, tool_input, tool_output, execution_time_ms, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                toolCallId,
                assistantMessageId,
                sessionId,
                tc.toolName,
                tc.toolInput,
                tc.toolOutput,
                tc.executionTimeMs,
                tc.status,
            ]
        );
    }

    // Update session counts
    await query(
        `UPDATE chat_sessions 
     SET message_count = message_count + 2, 
         tool_call_count = tool_call_count + ?
     WHERE id = ?`,
        [toolCalls.length, sessionId]
    );
}

// POST /api/chat/[agentId]/stream - Streaming chat with agentic support
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ agentId: string }> }
) {
    try {
        const { agentId } = await params;
        const body = await request.json();
        const { messages, sessionId: clientSessionId, clientName, clientLevel } = body as StreamRequestBody;

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return new Response(JSON.stringify({ error: 'Messages are required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Get agent
        const agent = await queryOne<Agent>(
            'SELECT * FROM agents WHERE id = ?',
            [agentId]
        );

        if (!agent) {
            return new Response(JSON.stringify({ error: 'Agent not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Get LLM config
        const llmConfig = await queryOne<LLMConfig>(
            'SELECT * FROM llm_configs WHERE agent_id = ?',
            [agentId]
        );

        if (!llmConfig) {
            return new Response(JSON.stringify({ error: 'LLM configuration not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Get API key
        const apiKeyRecord = await queryOne<APIKey>(
            'SELECT api_key FROM api_keys WHERE agent_id = ? AND provider = ?',
            [agentId, 'google']
        );

        if (!apiKeyRecord) {
            return new Response(JSON.stringify({ error: 'API key not configured' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Get MCP configurations
        const mcpConfigs = await query<MCPConfigDB[]>(
            'SELECT * FROM mcp_configs WHERE agent_id = ? AND enabled = true',
            [agentId]
        );

        // Get File Search store for RAG
        const fileSearchStore = await queryOne<{
            id: string;
            agent_id: string;
            store_name: string;
            display_name: string;
            enabled: boolean;
        }>(
            'SELECT * FROM file_search_stores WHERE agent_id = ? AND enabled = true',
            [agentId]
        );

        console.log(`Stream: File Search store: ${fileSearchStore?.store_name || 'none'}, enabled: ${fileSearchStore?.enabled}`);

        // Check if agentic mode
        if (llmConfig.agent_mode !== 'agentic') {
            return new Response(JSON.stringify({ error: 'Streaming only available for agentic mode' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Session management
        let sessionId = clientSessionId || null;
        let isNewSession = false;

        if (!sessionId) {
            sessionId = uuidv4();
            isNewSession = true;
        } else {
            // Check if session exists
            const existingSession = await queryOne<{ id: string }>(
                'SELECT id FROM chat_sessions WHERE id = ?',
                [sessionId]
            );
            if (!existingSession) {
                isNewSession = true;
            }
        }

        // Get the last user message for saving
        const lastUserMessage = messages[messages.length - 1];

        // Create SSE stream
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    const agenticConfig: AgenticConfig = {
                        apiKey: apiKeyRecord.api_key,
                        model: llmConfig.model,
                        systemPrompt: agent.system_prompt || undefined,
                        temperature: llmConfig.temperature,
                        maxTokens: llmConfig.max_tokens,
                        maxIterations: llmConfig.max_iterations || 10,
                    };

                    const result = await executeAgenticLoop(
                        messages,
                        agenticConfig,
                        mcpConfigs || [],
                        (update) => {
                            // Send SSE event
                            const data = JSON.stringify(update);
                            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                        },
                        fileSearchStore
                    );

                    // Save to database
                    try {
                        const toolCallsForDB = result.allToolCalls.map(tc => ({
                            toolName: tc.toolName,
                            toolInput: tc.toolInput,
                            toolOutput: tc.toolOutput,
                            executionTimeMs: tc.executionTimeMs,
                            status: tc.status as 'success' | 'error',
                        }));

                        await saveSessionAndMessages(
                            agentId,
                            sessionId!,
                            lastUserMessage,
                            result.finalResponse,
                            result.allThoughts && result.allThoughts.length > 0
                                ? result.allThoughts.join('\n\n---\n\n')
                                : null,
                            toolCallsForDB,
                            isNewSession,
                            clientName,
                            clientLevel
                        );
                    } catch (dbError) {
                        console.error('Failed to save to database:', dbError);
                    }

                    // Send final result with sessionId
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                        type: 'complete',
                        finalResponse: result.finalResponse,
                        totalIterations: result.totalIterations,
                        toolCallCount: result.allToolCalls.length,
                        sessionId: sessionId,
                    })}\n\n`));

                    controller.close();
                } catch (error) {
                    console.error('Streaming error:', error);
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                        type: 'error',
                        content: String(error),
                    })}\n\n`));
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
            },
        });
    } catch (error) {
        console.error('Stream endpoint error:', error);
        return new Response(JSON.stringify({ error: 'Failed to start stream' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
