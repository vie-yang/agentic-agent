'use client';

import { useState } from 'react';
import { Plus, Trash2, Server, Cloud } from 'lucide-react';

interface MCPConfig {
    id: string;
    name: string;
    type: 'local' | 'cloud';
    config_json: string;
    enabled: boolean;
}

interface MCPConfigFormProps {
    configs: MCPConfig[];
    onAdd: (config: Omit<MCPConfig, 'id'>) => Promise<void>;
    onUpdate: (id: string, config: Partial<MCPConfig>) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    isLoading?: boolean;
}

export default function MCPConfigForm({
    configs,
    onAdd,
    onUpdate,
    onDelete,
    isLoading,
}: MCPConfigFormProps) {
    const [showAddForm, setShowAddForm] = useState(false);
    const [newConfig, setNewConfig] = useState({
        name: '',
        type: 'local' as 'local' | 'cloud',
        config_json: '{\n  "command": "npx",\n  "args": ["-y", "@example/mcp-server"]\n}',
        enabled: true,
    });
    const [saving, setSaving] = useState(false);
    const [jsonError, setJsonError] = useState<string | null>(null);

    const validateJson = (jsonStr: string): boolean => {
        try {
            const parsed = JSON.parse(jsonStr);
            if (!parsed.command) {
                setJsonError('JSON must include a "command" field');
                return false;
            }
            setJsonError(null);
            return true;
        } catch (error) {
            setJsonError(`Invalid JSON: ${error instanceof Error ? error.message : 'Parse error'}`);
            return false;
        }
    };

    const handleConfigJsonChange = (value: string) => {
        setNewConfig({ ...newConfig, config_json: value });
        // Validate on change
        if (value.trim()) {
            validateJson(value);
        } else {
            setJsonError(null);
        }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newConfig.name.trim()) return;

        // Validate JSON before submit
        if (!validateJson(newConfig.config_json)) {
            return;
        }

        setSaving(true);
        try {
            await onAdd(newConfig);
            setNewConfig({
                name: '',
                type: 'local',
                config_json: '{\n  "command": "npx",\n  "args": ["-y", "@example/mcp-server"]\n}',
                enabled: true,
            });
            setJsonError(null);
            setShowAddForm(false);
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = async (config: MCPConfig) => {
        await onUpdate(config.id, { enabled: !config.enabled });
    };

    return (
        <div>
            <div className="flex items-center justify-end mb-4">
                <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => setShowAddForm(true)}
                >
                    <Plus size={16} />
                    Add Connection
                </button>
            </div>

            {/* Existing Configs */}
            <div className="flex flex-col gap-3 mb-6">
                {configs.length === 0 && !showAddForm && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="rounded-full bg-slate-100 p-4 mb-4">
                            <Server size={32} className="text-slate-400" />
                        </div>
                        <p className="text-slate-500">No MCP connections configured</p>
                    </div>
                )}

                {configs.map((config) => (
                    <div
                        key={config.id}
                        className="rounded-lg border bg-card p-4"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div
                                    className="flex items-center justify-center rounded-lg"
                                    style={{
                                        width: 40,
                                        height: 40,
                                        backgroundColor: config.type === 'local' ? '#dbeafe' : '#d1fae5',
                                        color: config.type === 'local' ? '#2563eb' : '#059669',
                                    }}
                                >
                                    {config.type === 'local' ? <Server size={20} /> : <Cloud size={20} />}
                                </div>
                                <div>
                                    <div className="font-medium text-foreground">{config.name}</div>
                                    <div className="text-sm text-slate-500" style={{ textTransform: 'capitalize' }}>
                                        {config.type} Server
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
                        <div className="rounded-lg bg-slate-900 p-3 overflow-x-auto">
                            <pre className="text-sm text-green-400 font-mono">{config.config_json}</pre>
                        </div>
                    </div>
                ))}
            </div>

            {/* Add Form */}
            {showAddForm && (
                <div className="card">
                    <h4 style={{ marginBottom: 'var(--space-4)' }}>New MCP Connection</h4>
                    <form onSubmit={handleAdd}>
                        <div className="form-group">
                            <label className="form-label">Name</label>
                            <input
                                type="text"
                                className="form-input"
                                value={newConfig.name}
                                onChange={(e) => setNewConfig({ ...newConfig, name: e.target.value })}
                                placeholder="e.g., Local File Server"
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Type</label>
                            <select
                                className="form-select"
                                value={newConfig.type}
                                onChange={(e) =>
                                    setNewConfig({ ...newConfig, type: e.target.value as 'local' | 'cloud' })
                                }
                            >
                                <option value="local">Local</option>
                                <option value="cloud">Cloud</option>
                            </select>
                            <p className="form-helper">
                                Local servers run on your machine, cloud servers connect remotely
                            </p>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Configuration (JSON)</label>
                            <textarea
                                className={`form-textarea ${jsonError ? 'error' : ''}`}
                                value={newConfig.config_json}
                                onChange={(e) => handleConfigJsonChange(e.target.value)}
                                rows={6}
                                style={{ fontFamily: 'monospace', fontSize: '13px' }}
                            />
                            {jsonError && (
                                <p className="form-error" style={{ color: 'var(--error)', marginTop: 'var(--space-2)', fontSize: '12px' }}>
                                    {jsonError}
                                </p>
                            )}
                            <p className="form-helper">
                                Example: {`{"command": "npx", "args": ["-y", "@example/mcp-server"]}`}
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <button type="submit" className="btn btn-primary" disabled={saving || !newConfig.name.trim() || !!jsonError}>
                                {saving ? 'Adding...' : 'Add Connection'}
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
