import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

interface RAGConfig {
    id: string;
    agent_id: string;
    type: string;
    connection_config: string;
    index_name: string;
    enabled: boolean;
}

// GET /api/agents/[id]/rag - Get RAG configs for agent
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const configs = await query<RAGConfig[]>(
            'SELECT * FROM rag_configs WHERE agent_id = ? ORDER BY created_at DESC',
            [id]
        );

        return NextResponse.json(configs);
    } catch (error) {
        console.error('Error fetching RAG configs:', error);
        return NextResponse.json(
            { error: 'Failed to fetch RAG configs' },
            { status: 500 }
        );
    }
}

// POST /api/agents/[id]/rag - Add RAG config
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { type = 'opensearch', connection_config, index_name, enabled = true } = body;

        if (!index_name) {
            return NextResponse.json(
                { error: 'Index name is required' },
                { status: 400 }
            );
        }

        const configId = uuidv4();
        await query(
            `INSERT INTO rag_configs (id, agent_id, type, connection_config, index_name, enabled)
       VALUES (?, ?, ?, ?, ?, ?)`,
            [configId, id, type, connection_config || '{}', index_name, enabled]
        );

        const config = await queryOne<RAGConfig>(
            'SELECT * FROM rag_configs WHERE id = ?',
            [configId]
        );

        return NextResponse.json(config, { status: 201 });
    } catch (error) {
        console.error('Error creating RAG config:', error);
        return NextResponse.json(
            { error: 'Failed to create RAG config' },
            { status: 500 }
        );
    }
}

// PUT /api/agents/[id]/rag - Update RAG config
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { configId, type, connection_config, index_name, enabled } = body;

        if (!configId) {
            return NextResponse.json(
                { error: 'Config ID is required' },
                { status: 400 }
            );
        }

        const updates: string[] = [];
        const values: unknown[] = [];

        if (type !== undefined) {
            updates.push('type = ?');
            values.push(type);
        }
        if (connection_config !== undefined) {
            updates.push('connection_config = ?');
            values.push(connection_config);
        }
        if (index_name !== undefined) {
            updates.push('index_name = ?');
            values.push(index_name);
        }
        if (enabled !== undefined) {
            updates.push('enabled = ?');
            values.push(enabled);
        }

        if (updates.length > 0) {
            values.push(configId, id);
            await query(
                `UPDATE rag_configs SET ${updates.join(', ')} WHERE id = ? AND agent_id = ?`,
                values
            );
        }

        const config = await queryOne<RAGConfig>(
            'SELECT * FROM rag_configs WHERE id = ?',
            [configId]
        );

        return NextResponse.json(config);
    } catch (error) {
        console.error('Error updating RAG config:', error);
        return NextResponse.json(
            { error: 'Failed to update RAG config' },
            { status: 500 }
        );
    }
}

// DELETE /api/agents/[id]/rag - Delete RAG config
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const configId = searchParams.get('configId');

        if (!configId) {
            return NextResponse.json(
                { error: 'Config ID is required' },
                { status: 400 }
            );
        }

        await query(
            'DELETE FROM rag_configs WHERE id = ? AND agent_id = ?',
            [configId, id]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting RAG config:', error);
        return NextResponse.json(
            { error: 'Failed to delete RAG config' },
            { status: 500 }
        );
    }
}
