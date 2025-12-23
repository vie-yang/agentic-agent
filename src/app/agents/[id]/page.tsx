'use client';

import { useState, useEffect, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import LLMConfigForm from '@/components/forms/LLMConfigForm';
import APIKeyForm from '@/components/forms/APIKeyForm';
import MCPConfigForm from '@/components/forms/MCPConfigForm';
import FileSearchForm from '@/components/forms/FileSearchForm';
import ChatWidget from '@/components/ChatWidget/ChatWidget';
import {
    ArrowLeft,
    Bot,
    Settings,
    Key,
    Server,
    Database,
    Code,
    Save,
    Trash2,
    Copy,
    Check,
    Loader2,
    Eye,
    EyeOff,
    Clock
} from 'lucide-react';
import SessionHistoryList from '@/components/agents/SessionHistoryList';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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

interface LLMConfig {
    provider: string;
    model: string;
    temperature: number;
    max_tokens: number;
}

interface APIKey {
    id: string;
    provider: string;
    api_key: string;
    created_at: string;
}

interface MCPConfig {
    id: string;
    name: string;
    type: 'local' | 'cloud';
    config_json: string;
    enabled: boolean;
}

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

type TabType = 'general' | 'llm' | 'apikeys' | 'mcp' | 'rag' | 'embed' | 'history';

interface NavItem {
    id: TabType;
    label: string;
    icon: React.ReactNode;
    description: string;
}

export default function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const searchParams = useSearchParams();
    
    // Initialize active tab from URL or default to 'general'
    const [activeTab, setActiveTab] = useState<TabType>((searchParams.get('tab') as TabType) || 'general');
    
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [agent, setAgent] = useState<Agent | null>(null);
    const [llmConfig, setLlmConfig] = useState<LLMConfig | null>(null);
    const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
    const [mcpConfigs, setMcpConfigs] = useState<MCPConfig[]>([]);
    const [fileSearchStore, setFileSearchStore] = useState<FileSearchStore | null>(null);
    const [fileSearchDocuments, setFileSearchDocuments] = useState<FileSearchDocument[]>([]);
    const [copied, setCopied] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    const navItems: NavItem[] = [
        { id: 'general', label: 'General', icon: <Settings className="h-5 w-5" />, description: 'Basic configuration' },
        { id: 'llm', label: 'LLM', icon: <Bot className="h-5 w-5" />, description: 'Model settings' },
        { id: 'apikeys', label: 'API Keys', icon: <Key className="h-5 w-5" />, description: 'Provider credentials' },
        { id: 'mcp', label: 'MCP', icon: <Server className="h-5 w-5" />, description: 'Context protocol' },
        { id: 'rag', label: 'RAG', icon: <Database className="h-5 w-5" />, description: 'Knowledge base' },
        { id: 'embed', label: 'Embed', icon: <Code className="h-5 w-5" />, description: 'Integration code' },
        { id: 'history', label: 'History', icon: <Clock className="h-5 w-5" />, description: 'Chat sessions' },
    ];

    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab);
        // Update URL without refreshing
        const url = new URL(window.location.href);
        url.searchParams.set('tab', tab);
        window.history.pushState({}, '', url);
    };

    const fetchAgent = async () => {
        try {
            const response = await fetch(`/api/agents/${id}`);
            if (!response.ok) throw new Error('Agent not found');
            const data = await response.json();
            setAgent(data);
        } catch (error) {
            console.error('Error fetching agent:', error);
            router.push('/agents');
        }
    };

    const fetchLlmConfig = async () => {
        try {
            const response = await fetch(`/api/agents/${id}/config`);
            if (response.ok) {
                const data = await response.json();
                setLlmConfig(data);
            }
        } catch (error) {
            console.error('Error fetching LLM config:', error);
        }
    };

    const fetchApiKeys = async () => {
        try {
            const response = await fetch(`/api/agents/${id}/keys`);
            if (response.ok) {
                const data = await response.json();
                setApiKeys(data);
            }
        } catch (error) {
            console.error('Error fetching API keys:', error);
        }
    };

    const fetchMcpConfigs = async () => {
        try {
            const response = await fetch(`/api/agents/${id}/mcp`);
            if (response.ok) {
                const data = await response.json();
                setMcpConfigs(data);
            }
        } catch (error) {
            console.error('Error fetching MCP configs:', error);
        }
    };

    const fetchFileSearch = async () => {
        try {
            const response = await fetch(`/api/agents/${id}/file-search`);
            if (response.ok) {
                const data = await response.json();
                setFileSearchStore(data.store);
                setFileSearchDocuments(data.documents || []);
            }
        } catch (error) {
            console.error('Error fetching file search config:', error);
        }
    };

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            await Promise.all([
                fetchAgent(),
                fetchLlmConfig(),
                fetchApiKeys(),
                fetchMcpConfigs(),
                fetchFileSearch(),
            ]);
            setLoading(false);
        };
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const handleSaveGeneral = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!agent) return;

        setSaving(true);
        try {
            const response = await fetch(`/api/agents/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: agent.name,
                    description: agent.description,
                    system_prompt: agent.system_prompt,
                    status: agent.status,
                    embed_token: agent.embed_token,
                    allowed_domains: agent.allowed_domains,
                }),
            });

            if (!response.ok) throw new Error('Failed to save');
            const updated = await response.json();
            setAgent(updated);
        } catch (error) {
            console.error('Error saving agent:', error);
            alert('Failed to save changes');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveLlmConfig = async (config: LLMConfig) => {
        const response = await fetch(`/api/agents/${id}/config`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config),
        });

        if (!response.ok) throw new Error('Failed to save');
        const updated = await response.json();
        setLlmConfig(updated);
    };

    const handleSaveApiKey = async (provider: string, apiKey: string) => {
        const response = await fetch(`/api/agents/${id}/keys`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider, api_key: apiKey }),
        });

        if (!response.ok) throw new Error('Failed to save');
        await fetchApiKeys();
    };

    const handleDeleteApiKey = async (keyId: string) => {
        const response = await fetch(`/api/agents/${id}/keys?keyId=${keyId}`, {
            method: 'DELETE',
        });

        if (!response.ok) throw new Error('Failed to delete');
        await fetchApiKeys();
    };

    const handleAddMcpConfig = async (config: Omit<MCPConfig, 'id'>) => {
        const response = await fetch(`/api/agents/${id}/mcp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config),
        });

        if (!response.ok) throw new Error('Failed to add');
        await fetchMcpConfigs();
    };

    const handleUpdateMcpConfig = async (configId: string, updates: Partial<MCPConfig>) => {
        const response = await fetch(`/api/agents/${id}/mcp`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ configId, ...updates }),
        });

        if (!response.ok) throw new Error('Failed to update');
        await fetchMcpConfigs();
    };

    const handleDeleteMcpConfig = async (configId: string) => {
        const response = await fetch(`/api/agents/${id}/mcp?configId=${configId}`, {
            method: 'DELETE',
        });

        if (!response.ok) throw new Error('Failed to delete');
        await fetchMcpConfigs();
    };

    const handleDeleteAgent = async () => {
        if (!confirm('Are you sure you want to delete this agent? This cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch(`/api/agents/${id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete');
            router.push('/agents');
        } catch (error) {
            console.error('Error deleting agent:', error);
            alert('Failed to delete agent');
        }
    };

    const getEmbedCode = () => {
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        return `<!-- AI Chat Widget -->
<script>
  (function() {
    var script = document.createElement('script');
    script.src = '${baseUrl}/widget.js';
    script.setAttribute('data-agent-id', '${id}');
    script.setAttribute('data-embed-token', '${agent?.embed_token}');
    script.setAttribute('data-api-url', '${baseUrl}/api/chat');
    document.body.appendChild(script);
  })();
</script>`;
    };

    const getIframeEmbedCode = () => {
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        return `<iframe 
  src="${baseUrl}/agents/embed/${agent?.embed_token}" 
  width="100%" 
  height="700px" 
  frameborder="0"
  style="border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);"
></iframe>`;
    };

    const handleCopyIframeCode = () => {
        navigator.clipboard.writeText(getIframeEmbedCode());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleCopyCode = () => {
        navigator.clipboard.writeText(getEmbedCode());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const getStatusVariant = (status: string) => {
        switch (status) {
            case 'active': return 'success';
            case 'inactive': return 'secondary';
            default: return 'outline';
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
                <p className="mt-4 text-muted-foreground">Loading agent...</p>
            </div>
        );
    }

    if (!agent) {
        return null;
    }

    const renderContent = () => {
        switch (activeTab) {
            case 'general':
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle>General Settings</CardTitle>
                            <CardDescription>Basic agent configuration</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSaveGeneral} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Agent Name</Label>
                                    <Input
                                        id="name"
                                        value={agent.name}
                                        onChange={(e) => setAgent({ ...agent, name: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="description">Description</Label>
                                    <textarea
                                        id="description"
                                        className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        value={agent.description || ''}
                                        onChange={(e) => setAgent({ ...agent, description: e.target.value })}
                                        rows={3}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="system_prompt">System Prompt</Label>
                                    <textarea
                                        id="system_prompt"
                                        className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        value={agent.system_prompt || ''}
                                        onChange={(e) => setAgent({ ...agent, system_prompt: e.target.value })}
                                        rows={6}
                                        placeholder="You are a helpful assistant..."
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        This prompt defines how the agent behaves and responds
                                    </p>
                                </div>

                                <div className="space-y-4 pt-4 border-t">
                                    <h3 className="text-sm font-semibold">Security Settings</h3>
                                    
                                    <div className="space-y-2">
                                        <Label htmlFor="embed_token">Embed Token</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                id="embed_token"
                                                value={agent.embed_token || ''}
                                                readOnly
                                                className="bg-muted"
                                            />
                                            <Button 
                                                variant="outline" 
                                                type="button"
                                                onClick={() => {
                                                    const newToken = Array.from(crypto.getRandomValues(new Uint8Array(32)))
                                                        .map(b => b.toString(16).padStart(2, '0'))
                                                        .join('');
                                                    setAgent({ ...agent, embed_token: newToken });
                                                }}
                                            >
                                                Regenerate
                                            </Button>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Unique token used to authorize chat requests from external sites.
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="allowed_domains">Allowed Domains</Label>
                                        <Input
                                            id="allowed_domains"
                                            value={agent.allowed_domains || ''}
                                            onChange={(e) => setAgent({ ...agent, allowed_domains: e.target.value })}
                                            placeholder="example.com, myapp.net"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Comma-separated list of domains allowed to embed this agent. Leave empty to allow all (not recommended).
                                        </p>
                                    </div>
                                </div>

                                <Button type="submit" disabled={saving} className="w-full sm:w-auto">
                                    {saving ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="mr-2 h-4 w-4" />
                                            Save Changes
                                        </>
                                    )}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                );
            case 'llm':
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle>LLM Configuration</CardTitle>
                            <CardDescription>Configure the language model settings</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {llmConfig && (
                                <LLMConfigForm
                                    config={llmConfig}
                                    onSave={handleSaveLlmConfig}
                                />
                            )}
                        </CardContent>
                    </Card>
                );
            case 'apikeys':
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle>API Keys</CardTitle>
                            <CardDescription>Manage API keys for different providers</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <APIKeyForm
                                apiKeys={apiKeys}
                                onSave={handleSaveApiKey}
                                onDelete={handleDeleteApiKey}
                            />
                        </CardContent>
                    </Card>
                );
            case 'mcp':
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle>MCP Configuration</CardTitle>
                            <CardDescription>Connect to Model Context Protocol servers</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <MCPConfigForm
                                configs={mcpConfigs}
                                onAdd={handleAddMcpConfig}
                                onUpdate={handleUpdateMcpConfig}
                                onDelete={handleDeleteMcpConfig}
                            />
                        </CardContent>
                    </Card>
                );
            case 'rag':
                return (
                    <FileSearchForm
                        agentId={id}
                        store={fileSearchStore}
                        documents={fileSearchDocuments}
                        onRefresh={fetchFileSearch}
                    />
                );
            case 'embed':
                return (
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Embed Code</CardTitle>
                                <CardDescription>Add this code to your website to embed the chat widget</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-4">
                                    <h4 className="text-sm font-semibold flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                        Floating Chat Widget
                                    </h4>
                                    <div className="relative rounded-lg bg-slate-900 p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs text-slate-400">HTML Snippet</span>
                                            <Button variant="ghost" size="sm" onClick={handleCopyCode} className="text-slate-400 hover:text-white">
                                                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                        <pre className="text-sm text-green-400 overflow-x-auto whitespace-pre-wrap">{getEmbedCode()}</pre>
                                    </div>
                                </div>

                                <div className="space-y-4 pt-6 border-t">
                                    <h4 className="text-sm font-semibold flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                        Full Page / Iframe Embed
                                    </h4>
                                    <div className="relative rounded-lg bg-slate-900 p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs text-slate-400">Iframe Snippet</span>
                                            <Button variant="ghost" size="sm" onClick={handleCopyIframeCode} className="text-slate-400 hover:text-white">
                                                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                        <pre className="text-sm text-green-400 overflow-x-auto whitespace-pre-wrap">{getIframeEmbedCode()}</pre>
                                    </div>
                                </div>

                                <Button variant="outline" onClick={() => setShowPreview(!showPreview)}>
                                    {showPreview ? (
                                        <>
                                            <EyeOff className="mr-2 h-4 w-4" />
                                            Hide Preview
                                        </>
                                    ) : (
                                        <>
                                            <Eye className="mr-2 h-4 w-4" />
                                            Show Preview
                                        </>
                                    )}
                                </Button>

                                {showPreview && (
                                    <div className="relative h-[400px] rounded-lg border bg-slate-100 overflow-hidden">
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <p className="text-muted-foreground">Your website content here</p>
                                        </div>
                                        <ChatWidget
                                            agentId={id}
                                            agentName={agent.name}
                                        />
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Customization Documentation */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Widget Customization</CardTitle>
                                <CardDescription>Customize the widget appearance using data attributes</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Colors */}
                                <div>
                                    <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-full bg-primary"></span>
                                        Colors
                                    </h4>
                                    <div className="grid gap-2 text-sm">
                                        <div className="grid grid-cols-[180px_1fr] gap-4 p-2 rounded bg-muted/50">
                                            <code className="text-primary">data-primary-color</code>
                                            <span className="text-muted-foreground">Main color for header and buttons (e.g., &quot;#10b981&quot;)</span>
                                        </div>
                                        <div className="grid grid-cols-[180px_1fr] gap-4 p-2 rounded">
                                            <code className="text-primary">data-secondary-color</code>
                                            <span className="text-muted-foreground">Secondary accent color</span>
                                        </div>
                                        <div className="grid grid-cols-[180px_1fr] gap-4 p-2 rounded bg-muted/50">
                                            <code className="text-primary">data-text-color</code>
                                            <span className="text-muted-foreground">Header text color (default: &quot;#ffffff&quot;)</span>
                                        </div>
                                        <div className="grid grid-cols-[180px_1fr] gap-4 p-2 rounded">
                                            <code className="text-primary">data-bg-color</code>
                                            <span className="text-muted-foreground">Chat window background</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Branding */}
                                <div>
                                    <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                                        Branding
                                    </h4>
                                    <div className="grid gap-2 text-sm">
                                        <div className="grid grid-cols-[180px_1fr] gap-4 p-2 rounded bg-muted/50">
                                            <code className="text-primary">data-title</code>
                                            <span className="text-muted-foreground">Widget header title (default: &quot;AI Assistant&quot;)</span>
                                        </div>
                                        <div className="grid grid-cols-[180px_1fr] gap-4 p-2 rounded">
                                            <code className="text-primary">data-subtitle</code>
                                            <span className="text-muted-foreground">Subtitle/status text (default: &quot;Online&quot;)</span>
                                        </div>
                                        <div className="grid grid-cols-[180px_1fr] gap-4 p-2 rounded bg-muted/50">
                                            <code className="text-primary">data-logo-url</code>
                                            <span className="text-muted-foreground">URL for custom logo in header</span>
                                        </div>
                                        <div className="grid grid-cols-[180px_1fr] gap-4 p-2 rounded">
                                            <code className="text-primary">data-avatar-url</code>
                                            <span className="text-muted-foreground">URL for bot avatar image</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Layout */}
                                <div>
                                    <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                                        Layout
                                    </h4>
                                    <div className="grid gap-2 text-sm">
                                        <div className="grid grid-cols-[180px_1fr] gap-4 p-2 rounded bg-muted/50">
                                            <code className="text-primary">data-position</code>
                                            <span className="text-muted-foreground">&quot;bottom-right&quot; or &quot;bottom-left&quot;</span>
                                        </div>
                                        <div className="grid grid-cols-[180px_1fr] gap-4 p-2 rounded">
                                            <code className="text-primary">data-width</code>
                                            <span className="text-muted-foreground">Widget width (e.g., &quot;400px&quot;)</span>
                                        </div>
                                        <div className="grid grid-cols-[180px_1fr] gap-4 p-2 rounded bg-muted/50">
                                            <code className="text-primary">data-height</code>
                                            <span className="text-muted-foreground">Widget height (e.g., &quot;600px&quot;)</span>
                                        </div>
                                        <div className="grid grid-cols-[180px_1fr] gap-4 p-2 rounded">
                                            <code className="text-primary">data-border-radius</code>
                                            <span className="text-muted-foreground">Corner radius (e.g., &quot;16px&quot;)</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Behavior */}
                                <div>
                                    <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-full bg-cyan-500"></span>
                                        Behavior
                                    </h4>
                                    <div className="grid gap-2 text-sm">
                                        <div className="grid grid-cols-[180px_1fr] gap-4 p-2 rounded bg-muted/50">
                                            <code className="text-primary">data-welcome-message</code>
                                            <span className="text-muted-foreground">Custom welcome message</span>
                                        </div>
                                        <div className="grid grid-cols-[180px_1fr] gap-4 p-2 rounded">
                                            <code className="text-primary">data-placeholder</code>
                                            <span className="text-muted-foreground">Input placeholder text</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Client Info */}
                                <div>
                                    <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                                        Client Info (for tracking)
                                    </h4>
                                    <div className="grid gap-2 text-sm">
                                        <div className="grid grid-cols-[180px_1fr] gap-4 p-2 rounded bg-muted/50">
                                            <code className="text-primary">data-client-name</code>
                                            <span className="text-muted-foreground">Client/user name (shown in history)</span>
                                        </div>
                                        <div className="grid grid-cols-[180px_1fr] gap-4 p-2 rounded">
                                            <code className="text-primary">data-client-level</code>
                                            <span className="text-muted-foreground">Client level (e.g., &quot;superadmin&quot;, &quot;manager&quot;, &quot;staff&quot;)</span>
                                        </div>
                                        <div className="grid grid-cols-[180px_1fr] gap-4 p-2 rounded bg-muted/50">
                                            <code className="text-primary">data-client-id</code>
                                            <span className="text-muted-foreground">Unique identifier for the client/user</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Example */}
                                <div className="pt-4 border-t">
                                    <h4 className="font-semibold text-sm mb-3">Example with Customization</h4>
                                    <div className="rounded-lg bg-slate-900 p-4">
                                        <pre className="text-xs text-green-400 overflow-x-auto whitespace-pre-wrap">{`<!-- AI Chat Widget with Customization -->
<script>
  (function() {
    var script = document.createElement('script');
    script.src = '${typeof window !== 'undefined' ? window.location.origin : ''}/widget.js';
    script.setAttribute('data-agent-id', '${id}');
    script.setAttribute('data-api-url', '${typeof window !== 'undefined' ? window.location.origin : ''}/api/chat');
    // Customization
    script.setAttribute('data-primary-color', '#10b981');
    script.setAttribute('data-title', 'Customer Support');
    script.setAttribute('data-subtitle', 'We\\'re here to help!');
    script.setAttribute('data-welcome-message', 'Hello! How can we assist you today?');
    script.setAttribute('data-placeholder', 'Ask me anything...');
    // Client Info (for tracking in history)
    script.setAttribute('data-client-id', 'user-12345');
    script.setAttribute('data-client-name', 'John Doe');
    script.setAttribute('data-client-level', 'manager');
    document.body.appendChild(script);
  })();
</script>`}</pre>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Iframe Customization Documentation */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Iframe Customization</CardTitle>
                                <CardDescription>Customize the iframe embed using URL parameters (query strings)</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <p className="text-sm text-muted-foreground">
                                    You can pass customization parameters directly in the <code>src</code> URL of the iframe.
                                </p>
                                
                                <div className="rounded-lg bg-slate-900 p-4">
                                    <pre className="text-xs text-green-400 overflow-x-auto whitespace-pre-wrap">{`<iframe
  src="${typeof window !== 'undefined' ? window.location.origin : ''}/agents/embed/${agent.embed_token}?title=Help+Center&primary-color=%23FF0000&client-id=USER123"
  width="100%"
  height="600"
  frameborder="0"
></iframe>`}</pre>
                                </div>

                                <div className="grid gap-2 text-sm mt-4">
                                    <h4 className="font-semibold text-sm mb-2">Supported Parameters</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <h5 className="font-medium mb-2 text-xs uppercase text-muted-foreground">Visuals</h5>
                                            <ul className="space-y-2">
                                                <li className="flex gap-2"><code className="text-primary text-xs">title</code></li>
                                                <li className="flex gap-2"><code className="text-primary text-xs">subtitle</code></li>
                                                <li className="flex gap-2"><code className="text-primary text-xs">primary-color</code></li>
                                                <li className="flex gap-2"><code className="text-primary text-xs">secondary-color</code></li>
                                                <li className="flex gap-2"><code className="text-primary text-xs">text-color</code></li>
                                                <li className="flex gap-2"><code className="text-primary text-xs">bg-color</code></li>
                                                <li className="flex gap-2"><code className="text-primary text-xs">logo-url</code></li>
                                                <li className="flex gap-2"><code className="text-primary text-xs">avatar-url</code></li>
                                            </ul>
                                        </div>
                                        <div>
                                            <h5 className="font-medium mb-2 text-xs uppercase text-muted-foreground">Content & Client</h5>
                                            <ul className="space-y-2">
                                                <li className="flex gap-2"><code className="text-primary text-xs">welcome-message</code></li>
                                                <li className="flex gap-2"><code className="text-primary text-xs">placeholder</code></li>
                                                <li className="flex gap-2"><code className="text-primary text-xs">client-id</code></li>
                                                <li className="flex gap-2"><code className="text-primary text-xs">client-name</code></li>
                                                <li className="flex gap-2"><code className="text-primary text-xs">client-level</code></li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                );
            case 'history':
                return <SessionHistoryList agentId={id} showHeader={false} />;
            default:
                return null;
        }
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/agents">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{agent.name}</h1>
                        <p className="text-muted-foreground">Configure your AI agent</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant={getStatusVariant(agent.status) as "default" | "secondary" | "destructive" | "outline" | "success"}>
                        {agent.status}
                    </Badge>
                    <Button variant="destructive" size="sm" onClick={handleDeleteAgent}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                    </Button>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* Sidebar Navigation - Vertical Tabs */}
                <div className="lg:w-64 flex-shrink-0">
                    <Card className="sticky top-6">
                        <CardContent className="p-2">
                            <nav className="space-y-1">
                                {navItems.map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => handleTabChange(item.id)}
                                        className={cn(
                                            "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200",
                                            activeTab === item.id
                                                ? "bg-primary-50 text-primary-700 border-l-4 border-primary-600"
                                                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-l-4 border-transparent"
                                        )}
                                    >
                                        <span className={cn(
                                            "flex-shrink-0",
                                            activeTab === item.id ? "text-primary-600" : "text-slate-400"
                                        )}>
                                            {item.icon}
                                        </span>
                                        <div className="min-w-0">
                                            <div className={cn(
                                                "font-medium truncate",
                                                activeTab === item.id ? "text-primary-700" : "text-slate-700"
                                            )}>
                                                {item.label}
                                            </div>
                                            <div className="text-xs text-slate-500 truncate">
                                                {item.description}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </nav>
                        </CardContent>
                    </Card>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 min-w-0">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
}
