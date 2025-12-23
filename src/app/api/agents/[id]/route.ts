import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

interface Agent {
    id: string;
    name: string;
    description: string | null;
    system_prompt: string | null;
    status: 'active' | 'inactive' | 'draft';
    embed_token: string | null;
    allowed_domains: string | null;
    created_at: string;
    updated_at: string;
}

// GET /api/agents/[id] - Get agent by ID
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const agent = await queryOne<Agent>(
            'SELECT * FROM agents WHERE id = ?',
            [id]
        );

        if (!agent) {
            return NextResponse.json(
                { error: 'Agent not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(agent);
    } catch (error) {
        console.error('Error fetching agent:', error);
        return NextResponse.json(
            { error: 'Failed to fetch agent' },
            { status: 500 }
        );
    }
}

// PUT /api/agents/[id] - Update agent
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { name, description, system_prompt, status, embed_token, allowed_domains } = body;

        // Check if agent exists
        const existing = await queryOne<Agent>(
            'SELECT * FROM agents WHERE id = ?',
            [id]
        );

        if (!existing) {
            return NextResponse.json(
                { error: 'Agent not found' },
                { status: 404 }
            );
        }

        // Build update query dynamically
        const updates: string[] = [];
        const values: unknown[] = [];

        if (name !== undefined) {
            updates.push('name = ?');
            values.push(name);
        }
        if (description !== undefined) {
            updates.push('description = ?');
            values.push(description);
        }
        if (system_prompt !== undefined) {
            updates.push('system_prompt = ?');
            values.push(system_prompt);
        }
        if (status !== undefined) {
            updates.push('status = ?');
            values.push(status);
        }
        if (embed_token !== undefined) {
            updates.push('embed_token = ?');
            values.push(embed_token);
        }
        if (allowed_domains !== undefined) {
            updates.push('allowed_domains = ?');
            values.push(allowed_domains);
        }

        if (updates.length > 0) {
            values.push(id);
            await query(
                `UPDATE agents SET ${updates.join(', ')} WHERE id = ?`,
                values
            );
        }

        const agent = await queryOne<Agent>(
            'SELECT * FROM agents WHERE id = ?',
            [id]
        );

        return NextResponse.json(agent);
    } catch (error) {
        console.error('Error updating agent:', error);
        return NextResponse.json(
            { error: 'Failed to update agent' },
            { status: 500 }
        );
    }
}

// DELETE /api/agents/[id] - Delete agent
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Check if agent exists
        const existing = await queryOne<Agent>(
            'SELECT * FROM agents WHERE id = ?',
            [id]
        );

        if (!existing) {
            return NextResponse.json(
                { error: 'Agent not found' },
                { status: 404 }
            );
        }

        await query('DELETE FROM agents WHERE id = ?', [id]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting agent:', error);
        return NextResponse.json(
            { error: 'Failed to delete agent' },
            { status: 500 }
        );
    }
}
