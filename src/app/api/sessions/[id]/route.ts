import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

interface ChatSession {
    id: string;
    agent_id: string;
    agent_name?: string;
    session_source: string;
    user_identifier: string | null;
    started_at: string;
    ended_at: string | null;
    message_count: number;
    tool_call_count: number;
}

interface ChatMessage {
    id: string;
    session_id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    thoughts: string | null;
    created_at: string;
    tool_calls?: ToolCall[];
}

interface ToolCall {
    id: string;
    message_id: string;
    session_id: string;
    tool_name: string;
    tool_input: string | null;
    tool_output: string | null;
    execution_time_ms: number | null;
    status: 'success' | 'error' | 'pending';
    created_at: string;
}

// GET /api/sessions/[id] - Get session details with messages and tool calls
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Get session with agent name
        const session = await queryOne<ChatSession>(
            `SELECT cs.*, a.name as agent_name 
       FROM chat_sessions cs 
       LEFT JOIN agents a ON cs.agent_id = a.id 
       WHERE cs.id = ?`,
            [id]
        );

        if (!session) {
            return NextResponse.json(
                { error: 'Session not found' },
                { status: 404 }
            );
        }

        // Get messages
        const messages = await query<ChatMessage[]>(
            `SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC`,
            [id]
        );

        // Get tool calls
        const toolCalls = await query<ToolCall[]>(
            `SELECT * FROM tool_calls WHERE session_id = ? ORDER BY created_at ASC`,
            [id]
        );

        // Attach tool calls to their messages
        const messagesWithToolCalls = messages.map((msg) => ({
            ...msg,
            tool_calls: toolCalls.filter((tc) => tc.message_id === msg.id),
        }));

        return NextResponse.json({
            session,
            messages: messagesWithToolCalls,
            toolCalls,
        });
    } catch (error) {
        console.error('Error fetching session:', error);
        return NextResponse.json(
            { error: 'Failed to fetch session' },
            { status: 500 }
        );
    }
}

// DELETE /api/sessions/[id] - Delete session and all related data
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        await query('DELETE FROM chat_sessions WHERE id = ?', [id]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting session:', error);
        return NextResponse.json(
            { error: 'Failed to delete session' },
            { status: 500 }
        );
    }
}
