import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import os from 'os';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB limit

interface FileSearchStore {
    id: string;
    agent_id: string;
    store_name: string;
    display_name: string;
    enabled: boolean;
}

// Helper to get API key for agent
async function getApiKeyForAgent(agentId: string): Promise<string | null> {
    const result = await queryOne<{ api_key: string }>(
        'SELECT api_key FROM api_keys WHERE agent_id = ? AND provider = ? LIMIT 1',
        [agentId, 'google']
    );
    return result?.api_key || null;
}

// POST: Upload file to FileSearchStore
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    let tempFilePath: string | null = null;

    try {
        const { id: agentId } = await params;

        // Get store for this agent
        const store = await queryOne<FileSearchStore>(
            'SELECT * FROM file_search_stores WHERE agent_id = ?',
            [agentId]
        );

        if (!store) {
            return NextResponse.json(
                { error: 'No file search store found. Please create one first.' },
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

        // Parse multipart form data
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json(
                { error: 'No file provided' },
                { status: 400 }
            );
        }

        // Check file size
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
                { status: 400 }
            );
        }

        // Validate file type
        const allowedTypes = [
            'application/pdf',
            'text/plain',
            'text/markdown',
            'text/csv',
            'application/json',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/html',
        ];

        const isAllowed = allowedTypes.some(type => file.type.includes(type) || file.name.endsWith('.md') || file.name.endsWith('.txt'));
        if (!isAllowed && !file.type.startsWith('text/')) {
            return NextResponse.json(
                { error: 'Unsupported file type. Supported: PDF, TXT, MD, CSV, JSON, DOCX, HTML' },
                { status: 400 }
            );
        }

        // Create document record in pending state
        const docId = uuidv4();
        await query(
            `INSERT INTO file_search_documents (id, store_id, file_name, display_name, mime_type, file_size_bytes, status)
             VALUES (?, ?, ?, ?, ?, ?, 'processing')`,
            [docId, store.id, file.name, file.name, file.type, file.size]
        );

        try {
            // Save file temporarily
            const tempDir = os.tmpdir();
            tempFilePath = path.join(tempDir, `${docId}_${file.name}`);
            const arrayBuffer = await file.arrayBuffer();
            fs.writeFileSync(tempFilePath, Buffer.from(arrayBuffer));

            console.log(`Uploading file to FileSearchStore: ${store.store_name}`);
            console.log(`Temp file path: ${tempFilePath}`);

            // Upload to Gemini FileSearchStore
            const ai = new GoogleGenAI({ apiKey });

            // Determine mime type
            let mimeType = file.type;
            if (!mimeType || mimeType === 'application/octet-stream') {
                // Fallback based on file extension
                const ext = file.name.split('.').pop()?.toLowerCase();
                const mimeMap: Record<string, string> = {
                    'pdf': 'application/pdf',
                    'txt': 'text/plain',
                    'md': 'text/markdown',
                    'csv': 'text/csv',
                    'json': 'application/json',
                    'html': 'text/html',
                    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                };
                mimeType = (ext && mimeMap[ext]) || 'text/plain';
            }

            console.log(`File mimeType: ${mimeType}`);

            let operation = await ai.fileSearchStores.uploadToFileSearchStore({
                file: tempFilePath,
                fileSearchStoreName: store.store_name,
                config: {
                    displayName: file.name,
                    mimeType: mimeType,
                },
            });

            console.log(`Upload operation started: ${operation.name}`);

            // Poll for completion (with timeout)
            const maxWait = 120000; // 120 seconds for larger files
            const startTime = Date.now();

            while (!operation.done && Date.now() - startTime < maxWait) {
                await new Promise(resolve => setTimeout(resolve, 3000));
                try {
                    operation = await ai.operations.get({ operation });
                    console.log(`Operation status: done=${operation.done}`);
                } catch (pollError) {
                    console.error('Error polling operation:', pollError);
                    // Continue polling
                }
            }

            if (!operation.done) {
                await query(
                    'UPDATE file_search_documents SET status = ?, error_message = ? WHERE id = ?',
                    ['error', 'Upload timed out after 120 seconds', docId]
                );
                return NextResponse.json(
                    { error: 'File upload timed out' },
                    { status: 500 }
                );
            }

            // Check for errors in the operation
            if (operation.error) {
                const errorMsg = JSON.stringify(operation.error);
                console.error('Operation error:', errorMsg);
                await query(
                    'UPDATE file_search_documents SET status = ?, error_message = ? WHERE id = ?',
                    ['error', errorMsg, docId]
                );
                return NextResponse.json(
                    { error: `Upload failed: ${errorMsg}` },
                    { status: 500 }
                );
            }

            // Update status to ready
            await query(
                'UPDATE file_search_documents SET status = ? WHERE id = ?',
                ['ready', docId]
            );

            console.log(`File uploaded successfully: ${file.name}`);

            const document = await queryOne(
                'SELECT * FROM file_search_documents WHERE id = ?',
                [docId]
            );

            return NextResponse.json({ document });
        } catch (uploadError) {
            console.error('Upload error:', uploadError);
            const errorMessage = uploadError instanceof Error ? uploadError.message : String(uploadError);
            await query(
                'UPDATE file_search_documents SET status = ?, error_message = ? WHERE id = ?',
                ['error', errorMessage, docId]
            );
            throw uploadError;
        }
    } catch (error) {
        console.error('Error uploading file:', error);
        return NextResponse.json(
            { error: 'Failed to upload file' },
            { status: 500 }
        );
    } finally {
        // Clean up temp file
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            try {
                fs.unlinkSync(tempFilePath);
            } catch (e) {
                console.error('Failed to delete temp file:', e);
            }
        }
    }
}

// DELETE: Delete a document from store
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: agentId } = await params;
        const { searchParams } = new URL(request.url);
        const docId = searchParams.get('docId');

        if (!docId) {
            return NextResponse.json(
                { error: 'Document ID required' },
                { status: 400 }
            );
        }

        // Verify document belongs to this agent's store
        const doc = await queryOne<{ id: string; store_id: string }>(
            `SELECT d.* FROM file_search_documents d
             JOIN file_search_stores s ON d.store_id = s.id
             WHERE d.id = ? AND s.agent_id = ?`,
            [docId, agentId]
        );

        if (!doc) {
            return NextResponse.json(
                { error: 'Document not found' },
                { status: 404 }
            );
        }

        await query('DELETE FROM file_search_documents WHERE id = ?', [docId]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting document:', error);
        return NextResponse.json(
            { error: 'Failed to delete document' },
            { status: 500 }
        );
    }
}
