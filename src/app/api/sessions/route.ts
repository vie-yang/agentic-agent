import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface ChatSession {
    id: string;
    agent_id: string;
    agent_name?: string;
    session_source: string;
    user_identifier: string | null;
    client_name: string | null;
    client_level: string | null;
    started_at: string;
    ended_at: string | null;
    message_count: number;
    tool_call_count: number;
}

// GET /api/sessions - Get all chat sessions with pagination
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
        const agentId = searchParams.get('agentId');
        const offset = (page - 1) * limit;

        let whereClause = '';
        const params: unknown[] = [];

        if (agentId) {
            whereClause = 'WHERE cs.agent_id = ?';
            params.push(agentId);
        }

        // Get sessions with agent name
        // Note: LIMIT and OFFSET are interpolated directly as they're sanitized integers
        const sessions = await query<ChatSession[]>(
            `SELECT cs.*, a.name as agent_name 
       FROM chat_sessions cs 
       LEFT JOIN agents a ON cs.agent_id = a.id 
       ${whereClause}
       ORDER BY cs.started_at DESC 
       LIMIT ${limit} OFFSET ${offset}`,
            params
        );

        // Get total count
        const countResult = await query<[{ total: number }]>(
            `SELECT COUNT(*) as total FROM chat_sessions cs ${whereClause}`,
            params
        );
        const total = countResult[0]?.total || 0;

        return NextResponse.json({
            sessions,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Error fetching sessions:', error);
        return NextResponse.json(
            { error: 'Failed to fetch sessions' },
            { status: 500 }
        );
    }
}

