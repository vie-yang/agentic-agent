'use client';

import { useState } from 'react';
import { Eye, EyeOff, Trash2, Plus, Key, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface APIKey {
    id: string;
    provider: string;
    api_key: string;
    created_at: string;
}

interface APIKeyFormProps {
    apiKeys: APIKey[];
    onSave: (provider: string, apiKey: string) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    isLoading?: boolean;
}

export default function APIKeyForm({ apiKeys, onSave, onDelete, isLoading }: APIKeyFormProps) {
    const [provider, setProvider] = useState('google');
    const [apiKey, setApiKey] = useState('');
    const [saving, setSaving] = useState(false);
    const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!apiKey.trim()) return;

        setSaving(true);
        try {
            await onSave(provider, apiKey);
            setApiKey('');
        } finally {
            setSaving(false);
        }
    };

    const toggleShowKey = (id: string) => {
        setShowKeys((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    const maskKey = (key: string) => {
        if (key.length <= 8) return '••••••••';
        return key.substring(0, 4) + '••••••••' + key.substring(key.length - 4);
    };

    return (
        <div className="space-y-6">
            {/* Existing Keys */}
            {apiKeys.length > 0 && (
                <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-slate-700">Stored API Keys</h4>
                    <div className="space-y-2">
                        {apiKeys.map((key) => (
                            <Card key={key.id} className="bg-slate-50">
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <Key className="h-4 w-4 text-slate-500" />
                                            <Badge variant="secondary" className="capitalize">
                                                {key.provider}
                                            </Badge>
                                        </div>
                                        <div className="text-sm text-slate-500 font-mono">
                                            {showKeys[key.id] ? key.api_key : maskKey(key.api_key)}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => toggleShowKey(key.id)}
                                        >
                                            {showKeys[key.id] ? (
                                                <EyeOff className="h-4 w-4" />
                                            ) : (
                                                <Eye className="h-4 w-4" />
                                            )}
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => onDelete(key.id)}
                                            disabled={isLoading}
                                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* Add New Key Form */}
            <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-700">Add New API Key</h4>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="provider">Provider</Label>
                        <select
                            id="provider"
                            value={provider}
                            onChange={(e) => setProvider(e.target.value)}
                            className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm transition-all duration-200 focus-visible:outline-none focus-visible:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-100"
                        >
                            <option value="google">Google (Gemini)</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="apiKey">API Key</Label>
                        <Input
                            id="apiKey"
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="Enter your API key"
                        />
                        <p className="text-xs text-slate-500">
                            Your API key will be stored securely and used for this agent only
                        </p>
                    </div>

                    <Button type="submit" disabled={saving || isLoading || !apiKey.trim()}>
                        {saving ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Plus className="mr-2 h-4 w-4" />
                                Add API Key
                            </>
                        )}
                    </Button>
                </form>
            </div>
        </div>
    );
}
