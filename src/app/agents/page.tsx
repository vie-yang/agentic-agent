import { Bot, Activity, Server, Key, Plus, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { query } from '@/lib/db';

interface Agent {
    id: string;
    name: string;
    description: string;
    status: 'active' | 'inactive' | 'draft';
    created_at: string;
    updated_at: string;
}

interface StatsResult {
    count: number;
}

async function getStats() {
    try {
        const totalAgentsResult = await query<StatsResult[]>('SELECT COUNT(*) as count FROM agents');
        const totalAgents = totalAgentsResult[0]?.count || 0;

        const activeAgentsResult = await query<StatsResult[]>("SELECT COUNT(*) as count FROM agents WHERE status = 'active'");
        const activeAgents = activeAgentsResult[0]?.count || 0;

        const mcpResult = await query<StatsResult[]>('SELECT COUNT(*) as count FROM mcp_configs');
        const mcpConnections = mcpResult[0]?.count || 0;

        const apiKeysResult = await query<StatsResult[]>('SELECT COUNT(*) as count FROM api_keys');
        const apiKeys = apiKeysResult[0]?.count || 0;

        const sessionsResult = await query<StatsResult[]>('SELECT COUNT(*) as count FROM chat_sessions');
        const totalSessions = sessionsResult[0]?.count || 0;

        return { totalAgents, activeAgents, mcpConnections, apiKeys, totalSessions };
    } catch (error) {
        console.error('Error fetching stats:', error);
        return { totalAgents: 0, activeAgents: 0, mcpConnections: 0, apiKeys: 0, totalSessions: 0 };
    }
}

async function getRecentAgents(): Promise<Agent[]> {
    try {
        const agents = await query<Agent[]>(
            'SELECT id, name, description, status, created_at, updated_at FROM agents ORDER BY updated_at DESC LIMIT 6'
        );
        return agents || [];
    } catch (error) {
        console.error('Error fetching recent agents:', error);
        return [];
    }
}

export default async function AgentsOverviewPage() {
    const stats = await getStats();
    const recentAgents = await getRecentAgents();

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'bg-green-100 text-green-700';
            case 'inactive': return 'bg-slate-100 text-slate-700';
            case 'draft': return 'bg-amber-100 text-amber-700';
            default: return 'bg-slate-100 text-slate-700';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Agents Overview</h1>
                    <p className="text-muted-foreground">Welcome back! Here&apos;s an overview of your AI agents.</p>
                </div>
                <Link href="/agents/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Create Agent
                    </Button>
                </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
                        <Bot className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalAgents}</div>
                        <p className="text-xs text-muted-foreground">Configured agents</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
                        <Activity className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.activeAgents}</div>
                        <p className="text-xs text-muted-foreground">Currently running</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Chat Sessions</CardTitle>
                        <MessageSquare className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalSessions}</div>
                        <p className="text-xs text-muted-foreground">Total conversations</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">MCP Servers</CardTitle>
                        <Server className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.mcpConnections}</div>
                        <p className="text-xs text-muted-foreground">Active connections</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">API Keys</CardTitle>
                        <Key className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.apiKeys}</div>
                        <p className="text-xs text-muted-foreground">Configured keys</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Recent Agents</CardTitle>
                        <CardDescription>Your recently created or updated agents</CardDescription>
                    </div>
                    <Link href="/agents/list">
                        <Button variant="outline" size="sm">View All</Button>
                    </Link>
                </CardHeader>
                <CardContent>
                    {recentAgents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                            <div className="rounded-full bg-blue-100 p-4 mb-4">
                                <Bot className="h-8 w-8 text-blue-600" />
                            </div>
                            <h3 className="text-lg font-semibold mb-2">No agents yet</h3>
                            <p className="text-muted-foreground max-w-md mb-4">
                                Create your first AI agent to get started. Agents can be configured with custom prompts,
                                LLM settings, and integrated with MCP servers.
                            </p>
                            <Link href="/agents/new">
                                <Button>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Create Your First Agent
                                </Button>
                            </Link>
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {recentAgents.map((agent) => (
                                <Link key={agent.id} href={`/agents/${agent.id}`}>
                                    <div className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                                                    <Bot className="h-4 w-4 text-blue-600" />
                                                </div>
                                                <h4 className="font-semibold text-sm">{agent.name}</h4>
                                            </div>
                                            <Badge className={getStatusColor(agent.status)}>{agent.status}</Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                                            {agent.description || 'No description'}
                                        </p>
                                        <p className="text-xs text-muted-foreground">Updated {formatDate(agent.updated_at)}</p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Quick Start Guide</CardTitle>
                    <CardDescription>Get started with AI agents in 3 simple steps</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-6 md:grid-cols-3">
                        <div className="space-y-2">
                            <div className="rounded-full bg-blue-100 p-3 w-fit">
                                <Bot className="h-5 w-5 text-blue-600" />
                            </div>
                            <h4 className="font-semibold">1. Create an Agent</h4>
                            <p className="text-sm text-muted-foreground">
                                Define your agent&apos;s name, description, and system prompt to guide its behavior.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <div className="rounded-full bg-green-100 p-3 w-fit">
                                <Key className="h-5 w-5 text-green-600" />
                            </div>
                            <h4 className="font-semibold">2. Configure LLM</h4>
                            <p className="text-sm text-muted-foreground">
                                Add your API key and select a Gemini model to power your agent&apos;s responses.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <div className="rounded-full bg-orange-100 p-3 w-fit">
                                <Server className="h-5 w-5 text-orange-600" />
                            </div>
                            <h4 className="font-semibold">3. Embed &amp; Deploy</h4>
                            <p className="text-sm text-muted-foreground">
                                Get the embed code and add the chat widget to any website or application.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
