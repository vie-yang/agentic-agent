'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, Smartphone, Globe, Shield, Database, Server, User } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function SetupPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [config, setConfig] = useState({
        project: {
            name: 'My AI Platform',
        },
        db: {
            host: 'localhost',
            port: '3306',
            user: 'root',
            password: '',
            database: 'agent_platform',
        },
        admin: {
            name: 'Super Admin',
            email: 'admin@example.com',
            password: 'password123',
        }
    });

    const handleNext = () => {
        setError(null);
        if (step === 2) {
            // Validate DB connection before proceeding
            testConnection();
        } else {
            setStep(step + 1);
        }
    };

    const handleBack = () => setStep(step - 1);

    const updateConfig = (section: 'project' | 'db' | 'admin', key: string, value: string) => {
        setConfig(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [key]: value
            }
        }));
    };

    const testConnection = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'test-db',
                    config: config.db
                })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);

            setStep(step + 1); // Proceed if success
        } catch (err: any) {
            setError(err.message || 'Connection failed');
        } finally {
            setLoading(false);
        }
    };

    const handleInstall = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'install',
                    projectConfig: config.project,
                    dbConfig: config.db,
                    adminConfig: config.admin
                })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);

            setSuccess('Installation successful! IMPORTANT: Please restart your server now to apply changes (Ctrl+C -> npm run dev). After restarting, you can login.');

            // Remove auto-redirect to let user read the message
            // setTimeout(() => {
            //     window.location.href = '/login';
            // }, 2000);

        } catch (err: any) {
            setError(err.message || 'Installation failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-lg shadow-lg">
                <CardHeader>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
                            <Smartphone className="h-5 w-5 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900">Project Setup</h1>
                    </div>
                    <CardTitle>
                        {step === 1 && 'Project Information'}
                        {step === 2 && 'Database Configuration'}
                        {step === 3 && 'Admin Account'}
                    </CardTitle>
                    <CardDescription>
                        {step === 1 && 'Configure your application details'}
                        {step === 2 && 'Connect to your MySQL database'}
                        {step === 3 && 'Create your superadmin account'}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {error && (
                        <Alert variant="destructive">
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {success && (
                        <Alert className="bg-green-50 text-green-700 border-green-200">
                            <CheckCircle className="h-4 w-4" />
                            <AlertTitle>Success</AlertTitle>
                            <AlertDescription>{success}</AlertDescription>
                        </Alert>
                    )}

                    {step === 1 && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Application Name</Label>
                                <Input
                                    value={config.project.name}
                                    onChange={(e) => updateConfig('project', 'name', e.target.value)}
                                    placeholder="My AI Platform"
                                />
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Host</Label>
                                    <Input
                                        value={config.db.host}
                                        onChange={(e) => updateConfig('db', 'host', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Port</Label>
                                    <Input
                                        value={config.db.port}
                                        onChange={(e) => updateConfig('db', 'port', e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Database Name</Label>
                                <Input
                                    value={config.db.database}
                                    onChange={(e) => updateConfig('db', 'database', e.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>User</Label>
                                    <Input
                                        value={config.db.user}
                                        onChange={(e) => updateConfig('db', 'user', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Password</Label>
                                    <Input
                                        type="password"
                                        value={config.db.password}
                                        onChange={(e) => updateConfig('db', 'password', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Full Name</Label>
                                <Input
                                    value={config.admin.name}
                                    onChange={(e) => updateConfig('admin', 'name', e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Email</Label>
                                <Input
                                    type="email"
                                    value={config.admin.email}
                                    onChange={(e) => updateConfig('admin', 'email', e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Password</Label>
                                <Input
                                    type="password"
                                    value={config.admin.password}
                                    onChange={(e) => updateConfig('admin', 'password', e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    {/* Step Indicators */}
                    <div className="flex gap-2 justify-center pt-4">
                        {[1, 2, 3].map((s) => (
                            <div
                                key={s}
                                className={`h-2 w-2 rounded-full ${s === step ? 'bg-blue-600' : 'bg-slate-200'} transition-all`}
                            />
                        ))}
                    </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                    <Button variant="outline" onClick={handleBack} disabled={step === 1 || loading}>
                        Back
                    </Button>

                    {step < 3 ? (
                        <Button onClick={handleNext} disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Next
                        </Button>
                    ) : (
                        <Button onClick={handleInstall} disabled={loading || !!success} className="bg-green-600 hover:bg-green-700">
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Finish Installation
                        </Button>
                    )}
                </CardFooter>
            </Card>
        </div>
    );
}
