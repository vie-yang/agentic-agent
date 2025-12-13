import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

interface LLMConfig {
    id: string;
    agent_id: string;
    provider: string;
    model: string;
    temperature: number;
    max_tokens: number;
    agent_mode: 'simple' | 'agentic';
    max_iterations: number;
}

// GET /api/agents/[id]/config - Get LLM config for agent
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const config = await queryOne<LLMConfig>(
            'SELECT * FROM llm_configs WHERE agent_id = ?',
            [id]
        );

        if (!config) {
            return NextResponse.json(
                { error: 'Config not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(config);
    } catch (error) {
        console.error('Error fetching LLM config:', error);
        return NextResponse.json(
            { error: 'Failed to fetch config' },
            { status: 500 }
        );
    }
}

// PUT /api/agents/[id]/config - Update LLM config
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const {
            provider,
            model,
            temperature,
            max_tokens,
            agent_mode = 'simple',
            max_iterations = 10,
        } = body;

        await query(
            `UPDATE llm_configs 
       SET provider = ?, model = ?, temperature = ?, max_tokens = ?, agent_mode = ?, max_iterations = ?
       WHERE agent_id = ?`,
            [provider, model, temperature, max_tokens, agent_mode, max_iterations, id]
        );

        const config = await queryOne<LLMConfig>(
            'SELECT * FROM llm_configs WHERE agent_id = ?',
            [id]
        );

        return NextResponse.json(config);
    } catch (error) {
        console.error('Error updating LLM config:', error);
        return NextResponse.json(
            { error: 'Failed to update config' },
            { status: 500 }
        );
    }
}
