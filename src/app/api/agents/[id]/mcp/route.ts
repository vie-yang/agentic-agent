import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

interface MCPConfig {
    id: string;
    agent_id: string;
    name: string;
    type: 'local' | 'cloud';
    config_json: string;
    enabled: boolean;
}

// GET /api/agents/[id]/mcp - Get MCP configs for agent
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const configs = await query<MCPConfig[]>(
            'SELECT * FROM mcp_configs WHERE agent_id = ? ORDER BY created_at DESC',
            [id]
        );

        return NextResponse.json(configs);
    } catch (error) {
        console.error('Error fetching MCP configs:', error);
        return NextResponse.json(
            { error: 'Failed to fetch MCP configs' },
            { status: 500 }
        );
    }
}

// POST /api/agents/[id]/mcp - Add MCP config
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { name, type = 'local', config_json, enabled = true } = body;

        if (!name) {
            return NextResponse.json(
                { error: 'Name is required' },
                { status: 400 }
            );
        }

        const configId = uuidv4();
        await query(
            `INSERT INTO mcp_configs (id, agent_id, name, type, config_json, enabled)
       VALUES (?, ?, ?, ?, ?, ?)`,
            [configId, id, name, type, config_json || '{}', enabled]
        );

        const config = await queryOne<MCPConfig>(
            'SELECT * FROM mcp_configs WHERE id = ?',
            [configId]
        );

        return NextResponse.json(config, { status: 201 });
    } catch (error) {
        console.error('Error creating MCP config:', error);
        return NextResponse.json(
            { error: 'Failed to create MCP config' },
            { status: 500 }
        );
    }
}

// PUT /api/agents/[id]/mcp - Update MCP config
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { configId, name, type, config_json, enabled } = body;

        if (!configId) {
            return NextResponse.json(
                { error: 'Config ID is required' },
                { status: 400 }
            );
        }

        const updates: string[] = [];
        const values: unknown[] = [];

        if (name !== undefined) {
            updates.push('name = ?');
            values.push(name);
        }
        if (type !== undefined) {
            updates.push('type = ?');
            values.push(type);
        }
        if (config_json !== undefined) {
            updates.push('config_json = ?');
            values.push(config_json);
        }
        if (enabled !== undefined) {
            updates.push('enabled = ?');
            values.push(enabled);
        }

        if (updates.length > 0) {
            values.push(configId, id);
            await query(
                `UPDATE mcp_configs SET ${updates.join(', ')} WHERE id = ? AND agent_id = ?`,
                values
            );
        }

        const config = await queryOne<MCPConfig>(
            'SELECT * FROM mcp_configs WHERE id = ?',
            [configId]
        );

        return NextResponse.json(config);
    } catch (error) {
        console.error('Error updating MCP config:', error);
        return NextResponse.json(
            { error: 'Failed to update MCP config' },
            { status: 500 }
        );
    }
}

// DELETE /api/agents/[id]/mcp - Delete MCP config
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
            'DELETE FROM mcp_configs WHERE id = ? AND agent_id = ?',
            [configId, id]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting MCP config:', error);
        return NextResponse.json(
            { error: 'Failed to delete MCP config' },
            { status: 500 }
        );
    }
}
