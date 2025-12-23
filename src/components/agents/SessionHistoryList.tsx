'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    MessageSquare,
    Bot,
    Clock,
    Wrench,
    ChevronLeft,
    ChevronRight,
    Trash2,
    RefreshCw,
    Search
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

interface ChatSession {
    id: string;
    agent_id: string;
    agent_name: string;
    session_source: string;
    user_identifier: string | null;
    client_name: string | null;
    client_level: string | null;
    started_at: string;
    ended_at: string | null;
    message_count: number;
    tool_call_count: number;
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

interface SessionHistoryListProps {
    agentId?: string;
    showHeader?: boolean;
}

export default function SessionHistoryList({ agentId, showHeader = true }: SessionHistoryListProps) {
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [pagination, setPagination] = useState<Pagination>({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
    });
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchSessions = async (page: number = 1) => {
        setLoading(true);
        try {
            let url = `/api/sessions?page=${page}&limit=20`;
            if (agentId) {
                url += `&agentId=${agentId}`;
            }
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch');
            const data = await response.json();
            setSessions(data.sessions);
            setPagination(data.pagination);
        } catch (error) {
            console.error('Error fetching sessions:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSessions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [agentId]);

    const handleDelete = async (sessionId: string) => {
        if (!confirm('Are you sure you want to delete this chat session?')) return;

        try {
            const response = await fetch(`/api/sessions/${sessionId}`, {
                method: 'DELETE',
            });
            if (response.ok) {
                fetchSessions(pagination.page);
            }
        } catch (error) {
            console.error('Error deleting session:', error);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('id-ID', {
            dateStyle: 'medium',
            timeStyle: 'short',
        });
    };

    const filteredSessions = sessions.filter(
        (session) =>
            (session.agent_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
            session.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (session.client_name?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            {showHeader && (
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold tracking-tight">Chat History</h2>
                        <p className="text-sm text-muted-foreground">View past conversations</p>
                    </div>
                </div>
            )}

            {/* Controls */}
            <div className="flex items-center justify-between gap-4">
                <Card className="flex-1">
                    <CardContent className="p-2">
                        <div className="flex items-center gap-2">
                            <Search className="h-4 w-4 text-muted-foreground ml-2" />
                            <Input
                                type="text"
                                placeholder={agentId ? "Search by session ID or client..." : "Search by agent, session ID or client..."}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="border-0 shadow-none focus-visible:ring-0 h-8"
                            />
                        </div>
                    </CardContent>
                </Card>
                <Button variant="outline" onClick={() => fetchSessions(pagination.page)} size="sm">
                    <RefreshCw className="mr-2 h-3 w-3" />
                    Refresh
                </Button>
            </div>


            {/* Loading */}
            {loading && (
                <div className="flex flex-col items-center justify-center py-12">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
                    <p className="mt-2 text-sm text-muted-foreground">Loading sessions...</p>
                </div>
            )}

            {/* Empty State */}
            {!loading && filteredSessions.length === 0 && (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                        <div className="rounded-full bg-primary-100 p-3 mb-3">
                            <MessageSquare className="h-6 w-6 text-primary-600" />
                        </div>
                        <h3 className="text-base font-semibold mb-1">No chat sessions found</h3>
                        <p className="text-sm text-muted-foreground max-w-xs">
                            {searchQuery ? 'Try adjusting your search query.' : 'Sessions will appear here once they are created.'}
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Sessions List */}
            {!loading && filteredSessions.length > 0 && (
                <Card>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {!agentId && <TableHead>Agent</TableHead>}
                                <TableHead>Client</TableHead>
                                <TableHead>Started</TableHead>
                                <TableHead>Messages</TableHead>
                                <TableHead>Tool Calls</TableHead>
                                <TableHead>Source</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredSessions.map((session) => (
                                <TableRow key={session.id}>
                                    {!agentId && (
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="rounded-full bg-primary-100 p-1.5">
                                                    <Bot className="h-3 w-3 text-primary-600" />
                                                </div>
                                                <div>
                                                    <div className="font-medium text-sm">{session.agent_name || 'Unknown'}</div>
                                                    <div className="text-[10px] text-muted-foreground font-mono">
                                                        {session.id.substring(0, 6)}...
                                                    </div>
                                                </div>
                                            </div>
                                        </TableCell>
                                    )}
                                    <TableCell>
                                        {session.client_name ? (
                                            <div>
                                                <div className="font-medium text-sm">{session.client_name}</div>
                                                {session.client_level && (
                                                    <Badge variant="outline" className="mt-0.5 text-[10px] h-4 px-1.5">
                                                        {session.client_level}
                                                    </Badge>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col">
                                                 <span className="text-muted-foreground text-sm">-</span>
                                                 {/* Show partial session ID if no client name, useful when filtered by agent */}
                                                 {agentId && (
                                                    <span className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                                        {session.id.substring(0, 8)}...
                                                    </span>
                                                 )}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                                            <Clock className="h-3 w-3" />
                                            {formatDate(session.started_at)}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className="gap-1 font-normal">
                                            <MessageSquare className="h-3 w-3" />
                                            {session.message_count}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant={session.tool_call_count > 0 ? 'success' : 'secondary'}
                                            className="gap-1 font-normal"
                                        >
                                            <Wrench className="h-3 w-3" />
                                            {session.tool_call_count}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm text-muted-foreground capitalize">
                                            {session.session_source}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Link href={`/agents/${session.agent_id}/session/${session.id}`}>
                                                <Button variant="ghost" size="sm" className="h-8">
                                                    View
                                                </Button>
                                            </Link>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDelete(session.id)}
                                                className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>

                    {/* Pagination */}
                    {pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between p-4 border-t">
                            <span className="text-sm text-muted-foreground">
                                Showing {(pagination.page - 1) * pagination.limit + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                            </span>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => fetchSessions(pagination.page - 1)}
                                    disabled={pagination.page === 1}
                                >
                                    <ChevronLeft className="h-4 w-4 mr-1" />
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => fetchSessions(pagination.page + 1)}
                                    disabled={pagination.page === pagination.totalPages}
                                >
                                    Next
                                    <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                            </div>
                        </div>
                    )}
                </Card>
            )}
        </div>
    );
}
