'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
    Shield,
    Plus,
    Edit2,
    Trash2,
    Check,
    Lock,
    Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { ExtendedSession, hasPermission } from '@/lib/auth-utils';

interface Permission {
    id: string;
    code: string;
    name: string;
    category: string;
}

interface Role {
    id: string;
    name: string;
    description: string;
    is_system: boolean;
    permissions: string[];
    created_at: string;
}

export default function RolesPage() {
    const { data: session } = useSession() as { data: ExtendedSession | null };
    const [roles, setRoles] = useState<Role[]>([]);
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        permissions: [] as string[],
    });

    const canManage = hasPermission(session, 'roles.manage');

    const fetchRoles = useCallback(async () => {
        try {
            const res = await fetch('/api/roles');
            if (res.ok) {
                const data = await res.json();
                setRoles(data.roles || []);
                setPermissions(data.permissions || []);
            }
        } catch (err) {
            console.error('Error fetching roles:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRoles();
    }, [fetchRoles]);

    const openCreateDialog = () => {
        setEditingRole(null);
        setFormData({ name: '', description: '', permissions: [] });
        setError('');
        setDialogOpen(true);
    };

    const openEditDialog = (role: Role) => {
        setEditingRole(role);
        setFormData({
            name: role.name,
            description: role.description || '',
            permissions: role.permissions || [],
        });
        setError('');
        setDialogOpen(true);
    };

    const handlePermissionToggle = (permId: string) => {
        setFormData((prev) => ({
            ...prev,
            permissions: prev.permissions.includes(permId)
                ? prev.permissions.filter((p) => p !== permId)
                : [...prev.permissions, permId],
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError('');

        try {
            const url = editingRole ? `/api/roles/${editingRole.id}` : '/api/roles';
            const method = editingRole ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Failed to save role');
                return;
            }

            setDialogOpen(false);
            fetchRoles();
        } catch {
            setError('Failed to save role');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (role: Role) => {
        if (!confirm(`Are you sure you want to delete "${role.name}"?`)) return;

        try {
            const res = await fetch(`/api/roles/${role.id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchRoles();
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to delete role');
            }
        } catch {
            alert('Failed to delete role');
        }
    };

    // Group permissions by category
    const permissionsByCategory = permissions.reduce((acc, perm) => {
        const cat = perm.category || 'Other';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(perm);
        return acc;
    }, {} as Record<string, Permission[]>);

    if (!hasPermission(session, 'roles.view')) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">You don&apos;t have permission to view this page.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Role Management</h1>
                    <p className="text-slate-500">Manage roles and their permissions</p>
                </div>
                {canManage && (
                    <Button onClick={openCreateDialog}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Role
                    </Button>
                )}
            </div>

            {/* Roles Grid */}
            {loading ? (
                <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {roles.map((role) => (
                        <Card key={role.id} className="relative">
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${role.is_system ? 'bg-amber-100' : 'bg-blue-100'
                                            }`}>
                                            {role.is_system ? (
                                                <Lock className="h-5 w-5 text-amber-600" />
                                            ) : (
                                                <Shield className="h-5 w-5 text-blue-600" />
                                            )}
                                        </div>
                                        <div>
                                            <CardTitle className="text-base">{role.name}</CardTitle>
                                            {role.is_system && (
                                                <Badge variant="outline" className="text-xs mt-1">
                                                    System
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                    {canManage && (
                                        <div className="flex gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => openEditDialog(role)}
                                            >
                                                <Edit2 className="h-4 w-4" />
                                            </Button>
                                            {!role.is_system && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDelete(role)}
                                                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground mb-3">
                                    {role.description || 'No description'}
                                </p>
                                <div className="flex flex-wrap gap-1">
                                    {role.permissions.slice(0, 5).map((permId) => {
                                        const perm = permissions.find((p) => p.id === permId);
                                        return perm ? (
                                            <Badge key={permId} variant="secondary" className="text-xs">
                                                {perm.code.split('.')[1]}
                                            </Badge>
                                        ) : null;
                                    })}
                                    {role.permissions.length > 5 && (
                                        <Badge variant="outline" className="text-xs">
                                            +{role.permissions.length - 5} more
                                        </Badge>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Create/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editingRole ? 'Edit Role' : 'Create Role'}
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm">
                                {error}
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium mb-1">Name</label>
                            <Input
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Role name"
                                required
                                disabled={editingRole?.is_system}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Description</label>
                            <Input
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Brief description"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-3">Permissions</label>
                            <div className="space-y-4 border rounded-lg p-4 bg-slate-50">
                                {Object.entries(permissionsByCategory).map(([category, perms]) => (
                                    <div key={category}>
                                        <h4 className="text-sm font-semibold text-slate-700 mb-2">{category}</h4>
                                        <div className="grid grid-cols-2 gap-2">
                                            {perms.map((perm) => (
                                                <label
                                                    key={perm.id}
                                                    className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${formData.permissions.includes(perm.id)
                                                        ? 'bg-blue-100 border-blue-300'
                                                        : 'bg-white border-slate-200'
                                                        } border`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.permissions.includes(perm.id)}
                                                        onChange={() => handlePermissionToggle(perm.id)}
                                                        className="h-4 w-4 rounded border-gray-300"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium truncate">{perm.name}</p>
                                                        <p className="text-xs text-muted-foreground">{perm.code}</p>
                                                    </div>
                                                    {formData.permissions.includes(perm.id) && (
                                                        <Check className="h-4 w-4 text-blue-600 shrink-0" />
                                                    )}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-4">
                            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={saving}>
                                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                {editingRole ? 'Update' : 'Create'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
