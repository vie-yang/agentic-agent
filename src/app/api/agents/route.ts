import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

interface Agent {
    id: string;
    name: string;
    description: string | null;
    system_prompt: string | null;
    status: 'active' | 'inactive' | 'draft';
    created_at: string;
    updated_at: string;
}

// GET /api/agents - List all agents
export async function GET() {
    try {
        const agents = await query<Agent[]>(
            'SELECT * FROM agents ORDER BY created_at DESC'
        );
        return NextResponse.json(agents);
    } catch (error) {
        console.error('Error fetching agents:', error);
        return NextResponse.json(
            { error: 'Failed to fetch agents' },
            { status: 500 }
        );
    }
}

// POST /api/agents - Create new agent
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, description, system_prompt, status = 'draft' } = body;

        if (!name) {
            return NextResponse.json(
                { error: 'Name is required' },
                { status: 400 }
            );
        }

        const id = uuidv4();
        const llmConfigId = uuidv4();

        // Create agent
        await query(
            `INSERT INTO agents (id, name, description, system_prompt, status)
       VALUES (?, ?, ?, ?, ?)`,
            [id, name, description || null, system_prompt || null, status]
        );

        // Create default LLM config
        await query(
            `INSERT INTO llm_configs (id, agent_id, provider, model, temperature, max_tokens)
       VALUES (?, ?, ?, ?, ?, ?)`,
            [llmConfigId, id, 'google', 'gemini-2.5-flash', 0.7, 2048]
        );

        const agent = await queryOne<Agent>(
            'SELECT * FROM agents WHERE id = ?',
            [id]
        );

        return NextResponse.json(agent, { status: 201 });
    } catch (error) {
        console.error('Error creating agent:', error);
        return NextResponse.json(
            { error: 'Failed to create agent' },
            { status: 500 }
        );
    }
}
