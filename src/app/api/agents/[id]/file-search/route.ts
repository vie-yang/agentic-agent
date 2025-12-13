import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenAI } from '@google/genai';

interface FileSearchStore {
    id: string;
    agent_id: string;
    store_name: string;
    display_name: string;
    enabled: boolean;
    created_at: string;
    updated_at: string;
}

interface FileSearchDocument {
    id: string;
    store_id: string;
    file_name: string;
    display_name: string;
    mime_type: string;
    file_size_bytes: number;
    status: 'pending' | 'processing' | 'ready' | 'error';
    error_message: string | null;
    uploaded_at: string;
}

// Helper to get API key for agent
async function getApiKeyForAgent(agentId: string): Promise<string | null> {
    const result = await queryOne<{ api_key: string }>(
        'SELECT api_key FROM api_keys WHERE agent_id = ? AND provider = ? LIMIT 1',
        [agentId, 'google']
    );
    return result?.api_key || null;
}

// GET: Get file search config and documents for agent
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: agentId } = await params;

        // Get file search store for agent
        const store = await queryOne<FileSearchStore>(
            'SELECT * FROM file_search_stores WHERE agent_id = ?',
            [agentId]
        );

        if (!store) {
            return NextResponse.json({ store: null, documents: [] });
        }

        // Get documents for this store
        const documents = await query<FileSearchDocument[]>(
            'SELECT * FROM file_search_documents WHERE store_id = ? ORDER BY uploaded_at DESC',
            [store.id]
        );

        return NextResponse.json({ store, documents });
    } catch (error) {
        console.error('Error fetching file search config:', error);
        return NextResponse.json(
            { error: 'Failed to fetch file search config' },
            { status: 500 }
        );
    }
}

// POST: Create FileSearchStore for agent
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: agentId } = await params;
        const { displayName } = await request.json();

        // Check if store already exists
        const existing = await queryOne<FileSearchStore>(
            'SELECT * FROM file_search_stores WHERE agent_id = ?',
            [agentId]
        );

        if (existing) {
            return NextResponse.json(
                { error: 'File search store already exists for this agent' },
                { status: 400 }
            );
        }

        // Get API key
        const apiKey = await getApiKeyForAgent(agentId);
        if (!apiKey) {
            return NextResponse.json(
                { error: 'No Google API key found for this agent' },
                { status: 400 }
            );
        }

        // Create FileSearchStore in Gemini API
        const ai = new GoogleGenAI({ apiKey });
        const fileSearchStore = await ai.fileSearchStores.create({
            config: {
                displayName: displayName || `Agent ${agentId} Knowledge Base`,
            },
        });

        // Save to database
        const id = uuidv4();
        await query(
            `INSERT INTO file_search_stores (id, agent_id, store_name, display_name, enabled)
             VALUES (?, ?, ?, ?, ?)`,
            [id, agentId, fileSearchStore.name, displayName || `Agent ${agentId} Knowledge Base`, true]
        );

        const store = await queryOne<FileSearchStore>(
            'SELECT * FROM file_search_stores WHERE id = ?',
            [id]
        );

        return NextResponse.json({ store });
    } catch (error) {
        console.error('Error creating file search store:', error);
        return NextResponse.json(
            { error: 'Failed to create file search store' },
            { status: 500 }
        );
    }
}

// DELETE: Delete FileSearchStore and all documents
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: agentId } = await params;

        // Get store
        const store = await queryOne<FileSearchStore>(
            'SELECT * FROM file_search_stores WHERE agent_id = ?',
            [agentId]
        );

        if (!store) {
            return NextResponse.json(
                { error: 'No file search store found' },
                { status: 404 }
            );
        }

        // Get API key and delete from Gemini
        const apiKey = await getApiKeyForAgent(agentId);
        if (apiKey && store.store_name) {
            try {
                const ai = new GoogleGenAI({ apiKey });
                await ai.fileSearchStores.delete({
                    name: store.store_name,
                    config: { force: true },
                });
            } catch (err) {
                console.error('Error deleting Gemini store:', err);
                // Continue with database deletion even if Gemini deletion fails
            }
        }

        // Delete from database (cascade will delete documents)
        await query('DELETE FROM file_search_stores WHERE id = ?', [store.id]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting file search store:', error);
        return NextResponse.json(
            { error: 'Failed to delete file search store' },
            { status: 500 }
        );
    }
}

// PATCH: Toggle enabled status
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: agentId } = await params;
        const { enabled } = await request.json();

        await query(
            'UPDATE file_search_stores SET enabled = ? WHERE agent_id = ?',
            [enabled, agentId]
        );

        const store = await queryOne<FileSearchStore>(
            'SELECT * FROM file_search_stores WHERE agent_id = ?',
            [agentId]
        );

        return NextResponse.json({ store });
    } catch (error) {
        console.error('Error updating file search store:', error);
        return NextResponse.json(
            { error: 'Failed to update file search store' },
            { status: 500 }
        );
    }
}
