'use client';

import { useState } from 'react';
import { Database, RefreshCw, Check, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';

export default function SettingsPage() {
    const [dbStatus, setDbStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [dbMessage, setDbMessage] = useState('');

    const initializeDatabase = async () => {
        setDbStatus('loading');
        setDbMessage('');

        try {
            const response = await fetch('/api/init');
            const data = await response.json();

            if (response.ok) {
                setDbStatus('success');
                setDbMessage('Database tables created successfully!');
            } else {
                setDbStatus('error');
                setDbMessage(data.error || 'Failed to initialize database');
            }
        } catch (error) {
            setDbStatus('error');
            setDbMessage('Failed to connect to the server');
            console.error(error);
        }
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground">Manage application settings</p>
            </div>

            {/* Database Settings */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="rounded-full bg-primary-100 p-2">
                            <Database className="h-5 w-5 text-primary-600" />
                        </div>
                        <div>
                            <CardTitle>Database</CardTitle>
                            <CardDescription>MySQL database configuration</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Table>
                        <TableBody>
                            <TableRow>
                                <TableCell className="font-medium">Host</TableCell>
                                <TableCell className="text-muted-foreground">localhost</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-medium">Database</TableCell>
                                <TableCell className="text-muted-foreground">fac_chat2</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-medium">User</TableCell>
                                <TableCell className="text-muted-foreground">root</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-medium">Port</TableCell>
                                <TableCell className="text-muted-foreground">3306</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>

                    <div className="flex items-center gap-3">
                        <Button
                            onClick={initializeDatabase}
                            disabled={dbStatus === 'loading'}
                        >
                            {dbStatus === 'loading' ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Initializing...
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Initialize Database
                                </>
                            )}
                        </Button>

                        {dbStatus === 'success' && (
                            <span className="flex items-center gap-2 text-green-600">
                                <Check className="h-4 w-4" />
                                {dbMessage}
                            </span>
                        )}

                        {dbStatus === 'error' && (
                            <span className="flex items-center gap-2 text-red-600">
                                <AlertCircle className="h-4 w-4" />
                                {dbMessage}
                            </span>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Instructions */}
            <Card>
                <CardHeader>
                    <CardTitle>Getting Started</CardTitle>
                    <CardDescription>Follow these steps to set up your AI Chat Agent</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <h4 className="font-semibold">1. Initialize Database</h4>
                            <p className="text-sm text-muted-foreground">
                                Click the &quot;Initialize Database&quot; button above to create the required tables.
                                Make sure MySQL is running with the correct credentials.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <h4 className="font-semibold">2. Create an Agent</h4>
                            <p className="text-sm text-muted-foreground">
                                Go to the Agents page and create your first AI agent. Define its name,
                                description, and system prompt.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <h4 className="font-semibold">3. Configure LLM</h4>
                            <p className="text-sm text-muted-foreground">
                                In the agent settings, configure the LLM by selecting a Gemini model and
                                adding your Google API key.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <h4 className="font-semibold">4. Add Integrations</h4>
                            <p className="text-sm text-muted-foreground">
                                Optionally connect MCP servers for extended capabilities or RAG databases
                                for knowledge retrieval.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <h4 className="font-semibold">5. Embed the Widget</h4>
                            <p className="text-sm text-muted-foreground">
                                Get the embed code from the agent&apos;s &quot;Embed Code&quot; tab and add it to your website.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
