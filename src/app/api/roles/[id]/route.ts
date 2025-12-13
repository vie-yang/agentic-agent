import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions, hasPermission, ExtendedSession } from '@/lib/auth';

interface Role {
    id: string;
    name: string;
    is_system: boolean;
}

// GET /api/roles/[id] - Get single role
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions) as ExtendedSession;

        if (!hasPermission(session, 'roles.view')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { id } = await params;

        const role = await queryOne<Role>(
            'SELECT * FROM roles WHERE id = ?',
            [id]
        );

        if (!role) {
            return NextResponse.json({ error: 'Role not found' }, { status: 404 });
        }

        const permissions = await query<{ permission_id: string }[]>(
            'SELECT permission_id FROM role_permissions WHERE role_id = ?',
            [id]
        );

        return NextResponse.json({
            ...role,
            permissions: permissions.map((p) => p.permission_id),
        });
    } catch (error) {
        console.error('Error fetching role:', error);
        return NextResponse.json({ error: 'Failed to fetch role' }, { status: 500 });
    }
}

// PUT /api/roles/[id] - Update role
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions) as ExtendedSession;

        if (!hasPermission(session, 'roles.manage')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { id } = await params;
        const body = await request.json();
        const { name, description, permissions } = body;

        // Check if role exists
        const existing = await queryOne<Role>('SELECT * FROM roles WHERE id = ?', [id]);
        if (!existing) {
            return NextResponse.json({ error: 'Role not found' }, { status: 404 });
        }

        // System roles can only update permissions, not name
        if (existing.is_system && name && name !== existing.name) {
            return NextResponse.json(
                { error: 'Cannot rename system roles' },
                { status: 400 }
            );
        }

        // Check if new name conflicts
        if (name) {
            const nameConflict = await queryOne<Role>(
                'SELECT id FROM roles WHERE name = ? AND id != ?',
                [name, id]
            );
            if (nameConflict) {
                return NextResponse.json({ error: 'Role name already in use' }, { status: 400 });
            }
        }

        // Update role
        if (name || description !== undefined) {
            const updates: string[] = [];
            const values: unknown[] = [];

            if (name && !existing.is_system) {
                updates.push('name = ?');
                values.push(name);
            }
            if (description !== undefined) {
                updates.push('description = ?');
                values.push(description);
            }

            if (updates.length > 0) {
                values.push(id);
                await query(`UPDATE roles SET ${updates.join(', ')} WHERE id = ?`, values);
            }
        }

        // Update permissions
        if (permissions !== undefined) {
            await query('DELETE FROM role_permissions WHERE role_id = ?', [id]);
            for (const permId of permissions) {
                await query(
                    'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
                    [id, permId]
                );
            }
        }

        return NextResponse.json({ message: 'Role updated successfully' });
    } catch (error) {
        console.error('Error updating role:', error);
        return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
    }
}

// DELETE /api/roles/[id] - Delete role
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions) as ExtendedSession;

        if (!hasPermission(session, 'roles.manage')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { id } = await params;

        // Check if role exists and is not system
        const role = await queryOne<Role>('SELECT * FROM roles WHERE id = ?', [id]);
        if (!role) {
            return NextResponse.json({ error: 'Role not found' }, { status: 404 });
        }

        if (role.is_system) {
            return NextResponse.json(
                { error: 'Cannot delete system roles' },
                { status: 400 }
            );
        }

        // Check if role is in use
        const usersWithRole = await query<{ id: string }[]>(
            'SELECT id FROM users WHERE role_id = ?',
            [id]
        );

        if (usersWithRole.length > 0) {
            return NextResponse.json(
                { error: `Cannot delete role: ${usersWithRole.length} user(s) are using this role` },
                { status: 400 }
            );
        }

        await query('DELETE FROM roles WHERE id = ?', [id]);

        return NextResponse.json({ message: 'Role deleted successfully' });
    } catch (error) {
        console.error('Error deleting role:', error);
        return NextResponse.json({ error: 'Failed to delete role' }, { status: 500 });
    }
}
