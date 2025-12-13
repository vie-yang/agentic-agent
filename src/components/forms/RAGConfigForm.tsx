'use client';

import { useState } from 'react';
import { Plus, Trash2, Database } from 'lucide-react';

interface RAGConfig {
    id: string;
    type: string;
    connection_config: string;
    index_name: string;
    enabled: boolean;
}

interface RAGConfigFormProps {
    configs: RAGConfig[];
    onAdd: (config: Omit<RAGConfig, 'id'>) => Promise<void>;
    onUpdate: (id: string, config: Partial<RAGConfig>) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    isLoading?: boolean;
}

const ragTypes = [
    { id: 'opensearch', name: 'OpenSearch', description: 'AWS OpenSearch / Elasticsearch' },
    { id: 'pinecone', name: 'Pinecone', description: 'Pinecone Vector Database' },
    { id: 'weaviate', name: 'Weaviate', description: 'Weaviate Vector Search' },
    { id: 'chromadb', name: 'ChromaDB', description: 'ChromaDB Local Vector Store' },
];

export default function RAGConfigForm({
    configs,
    onAdd,
    onUpdate,
    onDelete,
    isLoading,
}: RAGConfigFormProps) {
    const [showAddForm, setShowAddForm] = useState(false);
    const [newConfig, setNewConfig] = useState({
        type: 'opensearch',
        connection_config: '{\n  "host": "localhost",\n  "port": 9200,\n  "auth": {\n    "username": "",\n    "password": ""\n  }\n}',
        index_name: '',
        enabled: true,
    });
    const [saving, setSaving] = useState(false);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newConfig.index_name.trim()) return;

        setSaving(true);
        try {
            await onAdd(newConfig);
            setNewConfig({
                type: 'opensearch',
                connection_config: '{\n  "host": "localhost",\n  "port": 9200,\n  "auth": {\n    "username": "",\n    "password": ""\n  }\n}',
                index_name: '',
                enabled: true,
            });
            setShowAddForm(false);
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = async (config: RAGConfig) => {
        await onUpdate(config.id, { enabled: !config.enabled });
    };

    const getTypeName = (type: string) => {
        return ragTypes.find((t) => t.id === type)?.name || type;
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h4>RAG / Vector Database</h4>
                    <p className="text-sm text-muted">
                        Connect to vector databases for retrieval-augmented generation
                    </p>
                </div>
                <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => setShowAddForm(true)}
                >
                    <Plus size={16} />
                    Add Database
                </button>
            </div>

            {/* Existing Configs */}
            <div className="flex flex-col gap-3 mb-6">
                {configs.length === 0 && !showAddForm && (
                    <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                        <Database size={32} />
                        <p className="text-muted mt-4">No RAG databases configured</p>
                    </div>
                )}

                {configs.map((config) => (
                    <div
                        key={config.id}
                        className="card"
                        style={{ padding: 'var(--space-4)' }}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div
                                    className="stat-card-icon blue"
                                    style={{ width: 36, height: 36 }}
                                >
                                    <Database size={18} />
                                </div>
                                <div>
                                    <div className="font-medium">{getTypeName(config.type)}</div>
                                    <div className="text-xs text-muted">
                                        Index: {config.index_name}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="toggle">
                                    <input
                                        type="checkbox"
                                        className="toggle-input"
                                        checked={config.enabled}
                                        onChange={() => handleToggle(config)}
                                        disabled={isLoading}
                                    />
                                    <span className="toggle-slider"></span>
                                </label>
                                <button
                                    type="button"
                                    className="btn btn-ghost btn-icon"
                                    onClick={() => onDelete(config.id)}
                                    disabled={isLoading}
                                    style={{ color: 'var(--error)' }}
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                        <div className="code-block" style={{ fontSize: '12px' }}>
                            <pre>{config.connection_config}</pre>
                        </div>
                    </div>
                ))}
            </div>

            {/* Add Form */}
            {showAddForm && (
                <div className="card">
                    <h4 style={{ marginBottom: 'var(--space-4)' }}>New RAG Database</h4>
                    <form onSubmit={handleAdd}>
                        <div className="form-group">
                            <label className="form-label">Database Type</label>
                            <select
                                className="form-select"
                                value={newConfig.type}
                                onChange={(e) => setNewConfig({ ...newConfig, type: e.target.value })}
                            >
                                {ragTypes.map((type) => (
                                    <option key={type.id} value={type.id}>
                                        {type.name} - {type.description}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Index Name</label>
                            <input
                                type="text"
                                className="form-input"
                                value={newConfig.index_name}
                                onChange={(e) => setNewConfig({ ...newConfig, index_name: e.target.value })}
                                placeholder="e.g., my-knowledge-base"
                            />
                            <p className="form-helper">The name of the index/collection to query</p>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Connection Configuration (JSON)</label>
                            <textarea
                                className="form-textarea"
                                value={newConfig.connection_config}
                                onChange={(e) => setNewConfig({ ...newConfig, connection_config: e.target.value })}
                                rows={8}
                                style={{ fontFamily: 'monospace', fontSize: '13px' }}
                            />
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={saving || !newConfig.index_name.trim()}
                            >
                                {saving ? 'Adding...' : 'Add Database'}
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setShowAddForm(false)}
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
