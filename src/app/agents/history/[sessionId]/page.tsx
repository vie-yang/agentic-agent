'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    ArrowLeft,
    Bot,
    User,
    Clock,
    Wrench,
    CheckCircle,
    XCircle,
    ChevronDown,
    ChevronRight,
    Copy,
    Check,
    Brain,
    MessageSquare,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ChatSession {
    id: string;
    agent_id: string;
    agent_name: string;
    session_source: string;
    user_identifier: string | null;
    started_at: string;
    ended_at: string | null;
    message_count: number;
    tool_call_count: number;
}

interface ToolCall {
    id: string;
    message_id: string;
    session_id: string;
    tool_name: string;
    tool_input: string | null;
    tool_output: string | null;
    execution_time_ms: number | null;
    status: 'success' | 'error' | 'pending';
    created_at: string;
}

interface ChatMessage {
    id: string;
    session_id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    thoughts: string | null;
    created_at: string;
    tool_calls?: ToolCall[];
}

interface ThoughtSegment {
    id: string;
    content: string;
    toolCall?: ToolCall;
}

function parseThoughtsWithToolCalls(thoughts: string | null, toolCalls: ToolCall[] = []): ThoughtSegment[] {
    if (!thoughts) return [];
    const thoughtParts = thoughts.split('\n\n---\n\n').filter(p => p.trim());
    if (thoughtParts.length === 0) return [];
    if (toolCalls.length === 0) {
        return [{ id: 'thought-0', content: thoughts }];
    }
    const segments: ThoughtSegment[] = [];
    thoughtParts.forEach((part, index) => {
        segments.push({ id: `thought-${index}`, content: part, toolCall: toolCalls[index] });
    });
    if (toolCalls.length > thoughtParts.length) {
        for (let i = thoughtParts.length; i < toolCalls.length; i++) {
            segments.push({ id: `tool-only-${i}`, content: '', toolCall: toolCalls[i] });
        }
    }
    return segments;
}

export default function SessionDetailPage({
    params,
}: {
    params: Promise<{ sessionId: string }>;
}) {
    const { sessionId } = use(params);
    const [session, setSession] = useState<ChatSession | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedToolCalls, setExpandedToolCalls] = useState<Set<string>>(new Set());
    const [expandedThoughts, setExpandedThoughts] = useState<Set<string>>(new Set());
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const toggleThoughts = (id: string) => {
        const newExpanded = new Set(expandedThoughts);
        if (newExpanded.has(id)) newExpanded.delete(id);
        else newExpanded.add(id);
        setExpandedThoughts(newExpanded);
    };

    const toggleToolCall = (id: string) => {
        const newExpanded = new Set(expandedToolCalls);
        if (newExpanded.has(id)) newExpanded.delete(id);
        else newExpanded.add(id);
        setExpandedToolCalls(newExpanded);
    };

    const copyToClipboard = async (text: string, id: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    useEffect(() => {
        const fetchSession = async () => {
            try {
                const response = await fetch(`/api/sessions/${sessionId}`);
                if (!response.ok) throw new Error('Failed to fetch');
                const data = await response.json();
                setSession(data.session);
                setMessages(data.messages);
                setToolCalls(data.toolCalls);
            } catch (error) {
                console.error('Error fetching session:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchSession();
    }, [sessionId]);

    const formatTime = (timestamp: string) => {
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (timestamp: string) => {
        return new Date(timestamp).toLocaleDateString([], {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
        );
    }

    if (!session) {
        return (
            <div className="text-center py-12">
                <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">Session Not Found</h2>
                <p className="text-muted-foreground mb-4">The session you&apos;re looking for doesn&apos;t exist.</p>
                <Link href="/agents/history">
                    <Button>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to History
                    </Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/agents/history">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold">Chat Session</h1>
                    <p className="text-muted-foreground">Started {formatDate(session.started_at)}</p>
                </div>
            </div>

            <Card>
                <CardContent className="p-6">
                    <div className="grid grid-cols-4 gap-4">
                        <div>
                            <div className="text-sm text-muted-foreground mb-1">Agent</div>
                            <div className="flex items-center gap-2">
                                <Bot className="h-4 w-4 text-primary-600" />
                                <span className="font-medium">{session.agent_name}</span>
                            </div>
                        </div>
                        <div>
                            <div className="text-sm text-muted-foreground mb-1">Messages</div>
                            <div className="font-medium">{session.message_count}</div>
                        </div>
                        <div>
                            <div className="text-sm text-muted-foreground mb-1">Tool Calls</div>
                            <div className="font-medium">{session.tool_call_count}</div>
                        </div>
                        <div>
                            <div className="text-sm text-muted-foreground mb-1">Session ID</div>
                            <div className="font-medium font-mono text-xs">{session.id}</div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Conversation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {messages.map((message) => {
                        const messageToolCalls = message.tool_calls || toolCalls.filter(tc => tc.message_id === message.id);
                        const thoughtSegments = parseThoughtsWithToolCalls(message.thoughts, messageToolCalls);

                        return (
                            <div key={message.id} className="space-y-3">
                                <div className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                    <div className={`flex items-center justify-center rounded-full shrink-0 w-9 h-9 ${message.role === 'user' ? 'bg-primary-100 text-primary-600' : 'bg-slate-100 text-slate-600'}`}>
                                        {message.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                                    </div>
                                    <div className={`max-w-[80%] px-4 py-3 rounded-lg ${message.role === 'user' ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-900'}`}>
                                        {message.role === 'assistant' ? (
                                            <div className="prose prose-sm max-w-none prose-slate">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                                            </div>
                                        ) : (
                                            <div className="whitespace-pre-wrap">{message.content}</div>
                                        )}
                                        <div className="text-xs mt-2 opacity-70">{formatTime(message.created_at)}</div>
                                    </div>
                                </div>

                                {message.role === 'assistant' && thoughtSegments.length > 0 && (
                                    <div className="ml-12">
                                        <Card className="border border-purple-200 bg-gradient-to-br from-purple-50 to-white shadow-sm">
                                            <CardContent className="p-4">
                                                <button
                                                    className="flex items-center justify-between w-full text-left bg-transparent border-0 cursor-pointer"
                                                    onClick={() => toggleThoughts(message.id)}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-1.5 bg-purple-100 rounded-full">
                                                            <Brain className="h-4 w-4 text-purple-600" />
                                                        </div>
                                                        <span className="font-semibold text-purple-700">AI Thoughts</span>
                                                        <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">
                                                            {thoughtSegments.length} step{thoughtSegments.length > 1 ? 's' : ''}
                                                        </Badge>
                                                    </div>
                                                    <div className="p-1 hover:bg-purple-100 rounded transition-colors">
                                                        {expandedThoughts.has(message.id) ? (
                                                            <ChevronDown className="h-5 w-5 text-purple-500" />
                                                        ) : (
                                                            <ChevronRight className="h-5 w-5 text-purple-500" />
                                                        )}
                                                    </div>
                                                </button>

                                                {expandedThoughts.has(message.id) && (
                                                    <div className="mt-4 space-y-4">
                                                        {thoughtSegments.map((segment, index) => (
                                                            <div key={segment.id} className="relative bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                                                                <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-bold">
                                                                            {index + 1}
                                                                        </div>
                                                                        {segment.toolCall ? (
                                                                            <Badge variant={segment.toolCall.status === 'success' ? 'success' : 'destructive'} className="text-xs font-medium">
                                                                                <Wrench className="h-3 w-3 mr-1" />
                                                                                {segment.toolCall.tool_name}
                                                                                {segment.toolCall.execution_time_ms && (
                                                                                    <span className="ml-1 opacity-75">({segment.toolCall.execution_time_ms}ms)</span>
                                                                                )}
                                                                            </Badge>
                                                                        ) : (
                                                                            <span className="text-xs font-medium text-slate-500">Thinking...</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                {segment.content && (
                                                                    <div className="px-5 py-4">
                                                                        <div className="text-sm text-slate-600 leading-7 prose prose-sm max-w-none">
                                                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{segment.content}</ReactMarkdown>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {segment.toolCall && (
                                                                    <div className="border-t border-slate-100">
                                                                        <button
                                                                            className="flex items-center gap-2 w-full px-4 py-2 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors"
                                                                            onClick={(e) => { e.stopPropagation(); toggleToolCall(segment.toolCall!.id); }}
                                                                        >
                                                                            {expandedToolCalls.has(segment.toolCall.id) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                                                            <span className="font-medium">{expandedToolCalls.has(segment.toolCall.id) ? 'Hide' : 'Show'} tool details</span>
                                                                        </button>
                                                                        {expandedToolCalls.has(segment.toolCall.id) && (
                                                                            <div className="px-4 pb-4 space-y-3">
                                                                                <div className="rounded-lg border border-slate-200 overflow-hidden">
                                                                                    <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100 border-b border-slate-200">
                                                                                        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Input</span>
                                                                                        <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-slate-200" onClick={() => copyToClipboard(segment.toolCall!.tool_input || '', `input-${segment.toolCall!.id}`)}>
                                                                                            {copiedId === `input-${segment.toolCall!.id}` ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                                                                                        </Button>
                                                                                    </div>
                                                                                    <pre className="text-xs p-3 bg-white overflow-x-auto max-h-40 overflow-y-auto font-mono text-slate-700">{segment.toolCall.tool_input || 'No input'}</pre>
                                                                                </div>
                                                                                <div className="rounded-lg border border-slate-200 overflow-hidden">
                                                                                    <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100 border-b border-slate-200">
                                                                                        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Output</span>
                                                                                        <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-slate-200" onClick={() => copyToClipboard(segment.toolCall!.tool_output || '', `output-${segment.toolCall!.id}`)}>
                                                                                            {copiedId === `output-${segment.toolCall!.id}` ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                                                                                        </Button>
                                                                                    </div>
                                                                                    <pre className="text-xs p-3 bg-white overflow-x-auto max-h-56 overflow-y-auto font-mono text-slate-700">{segment.toolCall.tool_output || 'No output'}</pre>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </div>
                                )}

                                {message.role === 'assistant' && thoughtSegments.length === 0 && messageToolCalls.length > 0 && (
                                    <div className="ml-12 space-y-2">
                                        {messageToolCalls.map((tc) => (
                                            <Card key={tc.id} className={`border-l-4 ${tc.status === 'success' ? 'border-l-green-500 bg-green-50' : tc.status === 'error' ? 'border-l-red-500 bg-red-50' : 'border-l-yellow-500 bg-yellow-50'}`}>
                                                <CardContent className="p-3">
                                                    <button className="flex items-center justify-between w-full text-left bg-transparent border-0 cursor-pointer" onClick={() => toggleToolCall(tc.id)}>
                                                        <div className="flex items-center gap-2">
                                                            <Wrench className="h-4 w-4" />
                                                            <span className="font-medium text-sm">{tc.tool_name}</span>
                                                            {tc.execution_time_ms && <span className="text-xs text-muted-foreground">({tc.execution_time_ms}ms)</span>}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {tc.status === 'success' ? <CheckCircle className="h-4 w-4 text-green-600" /> : tc.status === 'error' ? <XCircle className="h-4 w-4 text-red-600" /> : <Clock className="h-4 w-4 text-yellow-600" />}
                                                            {expandedToolCalls.has(tc.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                        </div>
                                                    </button>
                                                    {expandedToolCalls.has(tc.id) && (
                                                        <div className="mt-3 space-y-3">
                                                            <div>
                                                                <div className="flex items-center justify-between mb-1">
                                                                    <span className="text-xs font-medium text-muted-foreground">Input</span>
                                                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(tc.tool_input || '', `input-${tc.id}`)}>
                                                                        {copiedId === `input-${tc.id}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                                                    </Button>
                                                                </div>
                                                                <pre className="text-xs bg-white p-2 rounded overflow-x-auto max-h-32">{tc.tool_input || 'No input'}</pre>
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center justify-between mb-1">
                                                                    <span className="text-xs font-medium text-muted-foreground">Output</span>
                                                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(tc.tool_output || '', `output-${tc.id}`)}>
                                                                        {copiedId === `output-${tc.id}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                                                    </Button>
                                                                </div>
                                                                <pre className="text-xs bg-white p-2 rounded overflow-x-auto max-h-48">{tc.tool_output || 'No output'}</pre>
                                                            </div>
                                                        </div>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </CardContent>
            </Card>

            {toolCalls.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Wrench className="h-5 w-5" />
                            Tool Call Summary
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-2">
                            {toolCalls.map((tc) => (
                                <div key={tc.id} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                                    <div className="flex items-center gap-2">
                                        {tc.status === 'success' ? <CheckCircle className="h-4 w-4 text-green-600" /> : tc.status === 'error' ? <XCircle className="h-4 w-4 text-red-600" /> : <Clock className="h-4 w-4 text-yellow-600" />}
                                        <span className="font-medium text-sm">{tc.tool_name}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                        {tc.execution_time_ms && <span>{tc.execution_time_ms}ms</span>}
                                        <span>{formatTime(tc.created_at)}</span>
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
