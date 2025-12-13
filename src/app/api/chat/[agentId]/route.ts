import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { generateChatWithMCP, MCPConfigDB } from '@/lib/ai-server';
import { executeAgenticLoop } from '@/lib/agentic-loop';
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

interface ChatRequestBody {
    messages: ChatMessage[];
    sessionId?: string;
    userIdentifier?: string;
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

// POST /api/chat/[agentId] - Send chat message
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ agentId: string }> }
) {
    const startTime = Date.now();

    try {
        const { agentId } = await params;
        const body: ChatRequestBody = await request.json();
        const { messages, sessionId: providedSessionId, clientName, clientLevel } = body;

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return NextResponse.json(
                { error: 'Messages are required' },
                { status: 400 }
            );
        }

        // Get agent
        const agent = await queryOne<Agent>(
            'SELECT * FROM agents WHERE id = ?',
            [agentId]
        );

        if (!agent) {
            return NextResponse.json(
                { error: 'Agent not found' },
                { status: 404 }
            );
        }

        // Get LLM config
        const llmConfig = await queryOne<LLMConfig>(
            'SELECT * FROM llm_configs WHERE agent_id = ?',
            [agentId]
        );

        if (!llmConfig) {
            return NextResponse.json(
                { error: 'LLM configuration not found' },
                { status: 404 }
            );
        }

        // Get API key
        const apiKeyRecord = await queryOne<APIKey>(
            'SELECT api_key FROM api_keys WHERE agent_id = ? AND provider = ?',
            [agentId, 'google']
        );

        if (!apiKeyRecord) {
            return NextResponse.json(
                { error: 'API key not configured for this agent' },
                { status: 400 }
            );
        }

        // Get MCP configurations
        const mcpConfigs = await query<MCPConfigDB[]>(
            'SELECT * FROM mcp_configs WHERE agent_id = ? AND enabled = true',
            [agentId]
        );

        console.log(`Chat request for agent: ${agent.name}`);
        console.log(`MCP configs found: ${mcpConfigs?.length || 0}`);

        // Determine session ID
        const sessionId = providedSessionId || uuidv4();
        const isNewSession = !providedSessionId;

        // Check if session exists when provided
        if (providedSessionId) {
            const existingSession = await queryOne<{ id: string }>(
                'SELECT id FROM chat_sessions WHERE id = ?',
                [providedSessionId]
            );
            if (!existingSession) {
                // Create session if it doesn't exist
                await query(
                    `INSERT INTO chat_sessions (id, agent_id, session_source, message_count, tool_call_count)
           VALUES (?, ?, 'widget', 0, 0)`,
                    [sessionId, agentId]
                );
            }
        }

        // Check agent mode and generate response accordingly
        const isAgenticMode = llmConfig.agent_mode === 'agentic';
        console.log(`Agent mode: ${llmConfig.agent_mode}, MCP configs: ${mcpConfigs?.length || 0}`);

        let chatResult: {
            response: string;
            thoughts: string | null;
            toolCalls: Array<{
                toolName: string;
                toolInput: string;
                toolOutput: string;
                executionTimeMs: number;
                status: 'success' | 'error';
            }>;
        };

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

        console.log(`File Search store query result:`, JSON.stringify(fileSearchStore));
        console.log(`File Search store: ${fileSearchStore?.store_name || 'none'}, enabled: ${fileSearchStore?.enabled}`);

        if (isAgenticMode) {
            // Use agentic loop for multi-step task execution
            const agenticResult = await executeAgenticLoop(
                messages,
                {
                    apiKey: apiKeyRecord.api_key,
                    model: llmConfig.model,
                    systemPrompt: agent.system_prompt || undefined,
                    temperature: llmConfig.temperature,
                    maxTokens: llmConfig.max_tokens,
                    maxIterations: llmConfig.max_iterations || 10,
                },
                mcpConfigs || [],
                undefined,
                fileSearchStore
            );

            chatResult = {
                response: agenticResult.finalResponse,
                thoughts: agenticResult.allThoughts.length > 0
                    ? agenticResult.allThoughts.join('\n\n---\n\n')
                    : null,
                toolCalls: agenticResult.allToolCalls,
            };

            console.log(`Agentic loop completed: ${agenticResult.totalIterations} iterations, ${agenticResult.allToolCalls.length} tool calls`);
        } else {
            // Use simple generation
            chatResult = await generateChatWithMCP(
                messages,
                {
                    apiKey: apiKeyRecord.api_key,
                    model: llmConfig.model,
                    systemPrompt: agent.system_prompt || undefined,
                    temperature: llmConfig.temperature,
                    maxTokens: llmConfig.max_tokens,
                },
                mcpConfigs || [],
                fileSearchStore
            );
        }

        const endTime = Date.now();

        console.log(`Chat completed: ${chatResult.toolCalls.length} tool calls tracked`);

        // Save to database
        try {
            const lastUserMessage = messages[messages.length - 1];
            await saveSessionAndMessages(
                agentId,
                sessionId,
                lastUserMessage,
                chatResult.response,
                chatResult.thoughts,
                chatResult.toolCalls,
                isNewSession,
                clientName,
                clientLevel
            );
            console.log(`Saved session ${sessionId} with ${chatResult.toolCalls.length} tool calls, thoughts: ${chatResult.thoughts ? 'yes' : 'no'}`);
        } catch (saveError) {
            console.error('Error saving chat history:', saveError);
            // Don't fail the request if saving fails
        }

        return NextResponse.json({
            message: chatResult.response,
            sessionId,
            executionTimeMs: endTime - startTime,
            toolCallCount: chatResult.toolCalls.length,
            agenticMode: isAgenticMode,
        });
    } catch (error) {
        console.error('Chat error:', error);
        return NextResponse.json(
            { error: 'Failed to generate response' },
            { status: 500 }
        );
    }
}

