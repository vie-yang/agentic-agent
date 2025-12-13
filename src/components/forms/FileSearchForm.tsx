'use client';

import { useState, useCallback } from 'react';
import { Upload, File, Trash2, Loader2, CheckCircle, AlertCircle, FolderOpen, Plus, Power, PowerOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface FileSearchStore {
    id: string;
    agent_id: string;
    store_name: string;
    display_name: string;
    enabled: boolean;
    created_at: string;
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

interface FileSearchFormProps {
    agentId: string;
    store: FileSearchStore | null;
    documents: FileSearchDocument[];
    onRefresh: () => void;
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getStatusBadge(status: string) {
    switch (status) {
        case 'ready':
            return <Badge variant="success"><CheckCircle className="h-3 w-3 mr-1" />Ready</Badge>;
        case 'processing':
            return <Badge variant="default"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Processing</Badge>;
        case 'error':
            return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Error</Badge>;
        default:
            return <Badge variant="secondary">Pending</Badge>;
    }
}

export default function FileSearchForm({ agentId, store, documents, onRefresh }: FileSearchFormProps) {
    const [creating, setCreating] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [dragActive, setDragActive] = useState(false);

    const handleCreateStore = async () => {
        setCreating(true);
        try {
            const response = await fetch(`/api/agents/${agentId}/file-search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ displayName: 'Knowledge Base' }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to create store');
            }

            onRefresh();
        } catch (error) {
            alert(`Error: ${error}`);
        } finally {
            setCreating(false);
        }
    };

    const handleToggleEnabled = async () => {
        if (!store) return;

        try {
            await fetch(`/api/agents/${agentId}/file-search`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: !store.enabled }),
            });
            onRefresh();
        } catch (error) {
            console.error('Error toggling store:', error);
        }
    };

    const handleDeleteStore = async () => {
        if (!confirm('Are you sure you want to delete the knowledge base? All documents will be removed.')) {
            return;
        }

        try {
            await fetch(`/api/agents/${agentId}/file-search`, {
                method: 'DELETE',
            });
            onRefresh();
        } catch (error) {
            console.error('Error deleting store:', error);
        }
    };

    const handleUpload = async (files: FileList | null) => {
        if (!files || files.length === 0 || !store) return;

        setUploading(true);

        for (const file of Array.from(files)) {
            try {
                const formData = new FormData();
                formData.append('file', file);

                const response = await fetch(`/api/agents/${agentId}/file-search/upload`, {
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || 'Upload failed');
                }
            } catch (error) {
                alert(`Failed to upload ${file.name}: ${error}`);
            }
        }

        setUploading(false);
        onRefresh();
    };

    const handleDeleteDocument = async (docId: string) => {
        setDeleting(docId);
        try {
            await fetch(`/api/agents/${agentId}/file-search/upload?docId=${docId}`, {
                method: 'DELETE',
            });
            onRefresh();
        } catch (error) {
            console.error('Error deleting document:', error);
        } finally {
            setDeleting(null);
        }
    };

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        handleUpload(e.dataTransfer.files);
    }, [store]);

    // No store created yet
    if (!store) {
        return (
            <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                    <FolderOpen className="h-12 w-12 text-slate-300 mb-4" />
                    <h3 className="text-lg font-semibold text-slate-700 mb-2">No Knowledge Base</h3>
                    <p className="text-sm text-slate-500 text-center mb-6 max-w-sm">
                        Create a knowledge base to upload documents. The AI will use these documents to provide more accurate answers.
                    </p>
                    <Button onClick={handleCreateStore} disabled={creating}>
                        {creating ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Creating...
                            </>
                        ) : (
                            <>
                                <Plus className="mr-2 h-4 w-4" />
                                Create Knowledge Base
                            </>
                        )}
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Store Status Card */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-lg">Knowledge Base</CardTitle>
                            <CardDescription>
                                Upload documents to enhance AI responses with your data
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant={store.enabled ? 'default' : 'outline'}
                                size="sm"
                                onClick={handleToggleEnabled}
                            >
                                {store.enabled ? (
                                    <>
                                        <Power className="mr-1 h-4 w-4" />
                                        Enabled
                                    </>
                                ) : (
                                    <>
                                        <PowerOff className="mr-1 h-4 w-4" />
                                        Disabled
                                    </>
                                )}
                            </Button>
                            <Button variant="destructive" size="sm" onClick={handleDeleteStore}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Upload Dropzone */}
                    <div
                        className={cn(
                            "border-2 border-dashed rounded-xl p-8 text-center transition-colors",
                            dragActive ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-300",
                            uploading && "opacity-50 pointer-events-none"
                        )}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                    >
                        <input
                            type="file"
                            id="file-upload"
                            className="hidden"
                            multiple
                            accept=".pdf,.txt,.md,.csv,.json,.docx,.html"
                            onChange={(e) => handleUpload(e.target.files)}
                            disabled={uploading}
                        />
                        <Upload className={cn("h-10 w-10 mx-auto mb-3", dragActive ? "text-blue-500" : "text-slate-400")} />
                        <p className="text-sm text-slate-600 mb-1">
                            {uploading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Uploading...
                                </span>
                            ) : (
                                <>Drag and drop files here, or </>
                            )}
                        </p>
                        {!uploading && (
                            <label
                                htmlFor="file-upload"
                                className="text-sm text-blue-500 hover:text-blue-600 cursor-pointer font-medium"
                            >
                                browse files
                            </label>
                        )}
                        <p className="text-xs text-slate-400 mt-2">
                            PDF, TXT, MD, CSV, JSON, DOCX, HTML (max 50MB per file)
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Documents List */}
            {documents.length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Uploaded Documents</CardTitle>
                        <CardDescription>{documents.length} file(s)</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {documents.map((doc) => (
                                <div
                                    key={doc.id}
                                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                                >
                                    <div className="flex items-center gap-3">
                                        <File className="h-5 w-5 text-slate-400" />
                                        <div>
                                            <p className="text-sm font-medium text-slate-700">{doc.file_name}</p>
                                            <p className="text-xs text-slate-500">
                                                {formatFileSize(doc.file_size_bytes)} • {new Date(doc.uploaded_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {getStatusBadge(doc.status)}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                                            onClick={() => handleDeleteDocument(doc.id)}
                                            disabled={deleting === doc.id}
                                        >
                                            {deleting === doc.id ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
