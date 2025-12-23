'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bot, Plus, Search, RefreshCw, ArrowRight, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface Agent {
    id: string;
    name: string;
    description: string | null;
    status: 'active' | 'inactive' | 'draft';
    created_at: string;
    updated_at: string;
}

export default function AgentListPage() {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [error, setError] = useState<string | null>(null);

    const fetchAgents = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/agents');
            if (!response.ok) throw new Error('Failed to fetch agents');
            const data = await response.json();
            setAgents(data);
        } catch (err) {
            setError('Failed to load agents. Make sure the database is initialized.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const initializeDatabase = async () => {
        try {
            const response = await fetch('/api/init');
            if (response.ok) {
                fetchAgents();
            }
        } catch (err) {
            console.error('Failed to initialize database:', err);
        }
    };

    useEffect(() => {
        fetchAgents();
    }, []);

    const filteredAgents = agents.filter(
        (agent) =>
            agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            agent.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getStatusVariant = (status: string) => {
        switch (status) {
            case 'active': return 'success';
            case 'inactive': return 'secondary';
            default: return 'outline';
        }
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Agent List</h1>
                    <p className="text-muted-foreground">Manage your AI chat agents</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" onClick={fetchAgents}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh
                    </Button>
                    <Link href="/agents/new">
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Create Agent
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Search */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                        <Search className="h-5 w-5 text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder="Search agents..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="border-0 shadow-none focus-visible:ring-0"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Error State */}
            {error && (
                <Card className="border-red-200 bg-red-50">
                    <CardContent className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-2 text-red-700">
                            <AlertCircle className="h-5 w-5" />
                            <p>{error}</p>
                        </div>
                        <Button size="sm" onClick={initializeDatabase}>
                            Initialize Database
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Loading State */}
            {loading && (
                <div className="flex flex-col items-center justify-center py-16">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
                    <p className="mt-4 text-muted-foreground">Loading agents...</p>
                </div>
            )}

            {/* Empty State */}
            {!loading && !error && filteredAgents.length === 0 && (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                        <div className="rounded-full bg-primary-100 p-4 mb-4">
                            <Bot className="h-8 w-8 text-primary-600" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">
                            {searchQuery ? 'No agents found' : 'No agents yet'}
                        </h3>
                        <p className="text-muted-foreground max-w-md mb-4">
                            {searchQuery
                                ? 'Try adjusting your search query'
                                : 'Create your first AI agent to get started. Configure it with custom prompts, LLM settings, and integrations.'}
                        </p>
                        {!searchQuery && (
                            <Link href="/agents/new">
                                <Button>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Create Your First Agent
                                </Button>
                            </Link>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Agents Grid */}
            {!loading && filteredAgents.length > 0 && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredAgents.map((agent) => (
                        <Card key={agent.id} className="hover:shadow-lg transition-shadow">
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="rounded-full bg-primary-100 p-2">
                                            <Bot className="h-5 w-5 text-primary-600" />
                                        </div>
                                        <CardTitle className="text-base">{agent.name}</CardTitle>
                                    </div>
                                    <Badge variant={getStatusVariant(agent.status) as "default" | "secondary" | "destructive" | "outline" | "success"}>
                                        {agent.status}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <CardDescription className="mb-4 line-clamp-2">
                                    {agent.description || 'No description'}
                                </CardDescription>
                                <div className="flex items-center justify-between text-sm text-muted-foreground">
                                    <span>Updated {new Date(agent.updated_at).toLocaleDateString()}</span>
                                    <Link href={`/agents/${agent.id}`}>
                                        <Button variant="ghost" size="sm" className="gap-1">
                                            View <ArrowRight className="h-4 w-4" />
                                        </Button>
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
