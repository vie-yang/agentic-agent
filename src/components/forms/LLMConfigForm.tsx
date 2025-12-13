'use client';

import { useState } from 'react';
import { GEMINI_MODELS } from '@/lib/ai';
import { Zap, Brain, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface LLMConfig {
    provider: string;
    model: string;
    temperature: number;
    max_tokens: number;
    agent_mode?: 'simple' | 'agentic';
    max_iterations?: number;
}

interface LLMConfigFormProps {
    config: LLMConfig;
    onSave: (config: LLMConfig) => Promise<void>;
    isLoading?: boolean;
}

export default function LLMConfigForm({ config, onSave, isLoading }: LLMConfigFormProps) {
    const [formData, setFormData] = useState<LLMConfig>({
        ...config,
        agent_mode: config.agent_mode || 'simple',
        max_iterations: config.max_iterations || 10,
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await onSave(formData);
        } finally {
            setSaving(false);
        }
    };

    const isAgenticMode = formData.agent_mode === 'agentic';

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Agentic Mode Section */}
            <div
                className={cn(
                    "p-4 rounded-xl border-2 transition-all duration-200",
                    isAgenticMode
                        ? "bg-purple-50 border-purple-300"
                        : "bg-slate-50 border-slate-200"
                )}
            >
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        {isAgenticMode ? (
                            <Brain className="h-5 w-5 text-purple-600" />
                        ) : (
                            <Zap className="h-5 w-5 text-slate-500" />
                        )}
                        <span className="font-semibold text-slate-800">Agent Mode</span>
                    </div>

                    {/* Custom Toggle Switch */}
                    <button
                        type="button"
                        role="switch"
                        aria-checked={isAgenticMode}
                        onClick={() => setFormData({
                            ...formData,
                            agent_mode: isAgenticMode ? 'simple' : 'agentic'
                        })}
                        className={cn(
                            "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2",
                            isAgenticMode ? "bg-purple-600" : "bg-slate-300"
                        )}
                    >
                        <span
                            className={cn(
                                "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                                isAgenticMode ? "translate-x-5" : "translate-x-0"
                            )}
                        />
                    </button>
                </div>

                <p className={cn(
                    "text-sm mb-3",
                    isAgenticMode ? "text-purple-700" : "text-slate-500"
                )}>
                    {isAgenticMode
                        ? '🚀 Agentic Mode: AI akan membuat planning, reasoning, dan eksekusi multi-step tasks secara otomatis.'
                        : '⚡ Simple Mode: AI merespons langsung tanpa iterasi tambahan.'}
                </p>

                {isAgenticMode && (
                    <div className="space-y-2">
                        <Label htmlFor="max_iterations" className="text-sm text-purple-700">
                            Max Iterations
                        </Label>
                        <Input
                            id="max_iterations"
                            type="number"
                            value={formData.max_iterations}
                            onChange={(e) => setFormData({
                                ...formData,
                                max_iterations: parseInt(e.target.value) || 10
                            })}
                            min={1}
                            max={20}
                            className="max-w-[120px] bg-white"
                        />
                        <p className="text-xs text-purple-600">
                            Jumlah maksimum iterasi yang diizinkan untuk menyelesaikan task (1-20)
                        </p>
                    </div>
                )}
            </div>

            {/* Provider */}
            <div className="space-y-2">
                <Label htmlFor="provider">Provider</Label>
                <select
                    id="provider"
                    value={formData.provider}
                    onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                    className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm transition-all duration-200 focus-visible:outline-none focus-visible:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-100"
                >
                    <option value="google">Google (Gemini)</option>
                </select>
                <p className="text-xs text-slate-500">Select the AI provider for this agent</p>
            </div>

            {/* Model */}
            <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <select
                    id="model"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm transition-all duration-200 focus-visible:outline-none focus-visible:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-100"
                >
                    {GEMINI_MODELS.map((model) => (
                        <option key={model.id} value={model.id}>
                            {model.name} - {model.description}
                        </option>
                    ))}
                </select>
                <p className="text-xs text-slate-500">Choose the Gemini model to use for responses</p>
            </div>

            {/* Temperature */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <Label htmlFor="temperature">Temperature</Label>
                    <span className="text-sm font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                        {formData.temperature}
                    </span>
                </div>
                <input
                    id="temperature"
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={formData.temperature}
                    onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <p className="text-xs text-slate-500">
                    Lower values make output more deterministic, higher values more creative (0-2)
                </p>
            </div>

            {/* Max Tokens */}
            <div className="space-y-2">
                <Label htmlFor="max_tokens">Max Tokens</Label>
                <Input
                    id="max_tokens"
                    type="number"
                    value={formData.max_tokens}
                    onChange={(e) => setFormData({ ...formData, max_tokens: parseInt(e.target.value) || 2048 })}
                    min={1}
                    max={8192}
                />
                <p className="text-xs text-slate-500">Maximum number of tokens in the response (1-8192)</p>
            </div>

            <Button type="submit" disabled={saving || isLoading}>
                {saving ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                    </>
                ) : (
                    <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Configuration
                    </>
                )}
            </Button>
        </form>
    );
}
