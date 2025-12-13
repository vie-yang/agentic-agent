'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Bot, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function NewAgentPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<{
        name: string;
        description: string;
        system_prompt: string;
        status: 'draft' | 'active' | 'inactive';
    }>({
        name: '',
        description: '',
        system_prompt: '',
        status: 'draft',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) return;

        setLoading(true);
        try {
            const response = await fetch('/api/agents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (!response.ok) throw new Error('Failed to create agent');

            const agent = await response.json();
            router.push(`/agents/${agent.id}`);
        } catch (error) {
            console.error('Error creating agent:', error);
            alert('Failed to create agent. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center gap-4">
                <Link href="/agents">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Create New Agent</h1>
                    <p className="text-muted-foreground">Set up a new AI chat agent</p>
                </div>
            </div>

            <Card className="max-w-2xl">
                <CardHeader>
                    <CardTitle>Agent Details</CardTitle>
                    <CardDescription>Configure your new agent&apos;s basic settings</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Agent Name *</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g., Customer Support Bot"
                                required
                            />
                            <p className="text-xs text-muted-foreground">A descriptive name for your agent</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <textarea
                                id="description"
                                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Describe what this agent does..."
                                rows={3}
                            />
                            <p className="text-xs text-muted-foreground">Brief description of the agent&apos;s purpose</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="system_prompt">System Prompt</Label>
                            <textarea
                                id="system_prompt"
                                className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                value={formData.system_prompt}
                                onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                                placeholder="You are a helpful assistant..."
                                rows={6}
                            />
                            <p className="text-xs text-muted-foreground">
                                Instructions that define the agent&apos;s behavior and personality
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="status">Initial Status</Label>
                            <select
                                id="status"
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                value={formData.status}
                                onChange={(e) =>
                                    setFormData({ ...formData, status: e.target.value as 'draft' | 'active' | 'inactive' })
                                }
                            >
                                <option value="draft">Draft</option>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                            <p className="text-xs text-muted-foreground">Set to Active when ready to use</p>
                        </div>

                        <div className="flex items-center gap-3 pt-4">
                            <Button type="submit" disabled={loading || !formData.name.trim()}>
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        <Bot className="mr-2 h-4 w-4" />
                                        Create Agent
                                    </>
                                )}
                            </Button>
                            <Link href="/agents">
                                <Button variant="outline">Cancel</Button>
                            </Link>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
