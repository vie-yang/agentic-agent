import { NextRequest, NextResponse } from 'next/server';
import { queryOne, query } from '@/lib/db';
import { getToken } from 'next-auth/jwt';

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
    embed_token?: string;
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
            `SELECT cs.*, a.name as agent_name, a.embed_token 
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

        // Authorization check
        // 1. Check for Embed Token (Public Widget)
        const embedTokenHeader = request.headers.get('x-embed-token') || 
                                 request.headers.get('authorization')?.replace('Bearer ', '');
        
        // 2. Check for Authenticated User (Admin)
        let isAuthorized = false;

        if (embedTokenHeader) {
            // Validate token against agent's token
            // Ensure session belongs to an agent with this token
            if (session.embed_token && session.embed_token === embedTokenHeader) {
                isAuthorized = true;
            }
        } else {
            // Fallback to NextAuth for internal admin usage
            const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET || 'agentforge-secret-key-change-in-production' });
            if (token) {
                isAuthorized = true;
            }
        }

        if (!isAuthorized) {
            return NextResponse.json(
                { error: 'Unauthorized Access' },
                { status: 401 }
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
