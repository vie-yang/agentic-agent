import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

interface APIKey {
    id: string;
    agent_id: string;
    provider: string;
    api_key: string;
    created_at: string;
}

// GET /api/agents/[id]/keys - Get API keys for agent
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const keys = await query<APIKey[]>(
            'SELECT * FROM api_keys WHERE agent_id = ? ORDER BY created_at DESC',
            [id]
        );

        return NextResponse.json(keys);
    } catch (error) {
        console.error('Error fetching API keys:', error);
        return NextResponse.json(
            { error: 'Failed to fetch API keys' },
            { status: 500 }
        );
    }
}

// POST /api/agents/[id]/keys - Add API key
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { provider, api_key } = body;

        if (!provider || !api_key) {
            return NextResponse.json(
                { error: 'Provider and API key are required' },
                { status: 400 }
            );
        }

        // Check if key for this provider already exists
        const existing = await queryOne<APIKey>(
            'SELECT * FROM api_keys WHERE agent_id = ? AND provider = ?',
            [id, provider]
        );

        if (existing) {
            // Update existing key
            await query(
                'UPDATE api_keys SET api_key = ? WHERE id = ?',
                [api_key, existing.id]
            );

            const updated = await queryOne<APIKey>(
                'SELECT * FROM api_keys WHERE id = ?',
                [existing.id]
            );

            return NextResponse.json(updated);
        }

        // Create new key
        const keyId = uuidv4();
        await query(
            'INSERT INTO api_keys (id, agent_id, provider, api_key) VALUES (?, ?, ?, ?)',
            [keyId, id, provider, api_key]
        );

        const newKey = await queryOne<APIKey>(
            'SELECT * FROM api_keys WHERE id = ?',
            [keyId]
        );

        return NextResponse.json(newKey, { status: 201 });
    } catch (error) {
        console.error('Error adding API key:', error);
        return NextResponse.json(
            { error: 'Failed to add API key' },
            { status: 500 }
        );
    }
}

// DELETE /api/agents/[id]/keys - Delete API key (expects keyId in query params)
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const keyId = searchParams.get('keyId');

        if (!keyId) {
            return NextResponse.json(
                { error: 'Key ID is required' },
                { status: 400 }
            );
        }

        await query(
            'DELETE FROM api_keys WHERE id = ? AND agent_id = ?',
            [keyId, id]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting API key:', error);
        return NextResponse.json(
            { error: 'Failed to delete API key' },
            { status: 500 }
        );
    }
}
