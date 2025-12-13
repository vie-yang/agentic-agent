import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { getServerSession } from 'next-auth';
import { authOptions, hasPermission, ExtendedSession } from '@/lib/auth';

interface Role {
    id: string;
    name: string;
    description: string;
    is_system: boolean;
    created_at: string;
}

interface Permission {
    id: string;
    code: string;
    name: string;
    category: string;
}

interface RolePermission {
    permission_id: string;
}

// GET /api/roles - Get all roles with permissions
export async function GET() {
    try {
        const session = await getServerSession(authOptions) as ExtendedSession;

        if (!hasPermission(session, 'roles.view')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const roles = await query<Role[]>(
            'SELECT * FROM roles ORDER BY is_system DESC, name ASC'
        );

        const permissions = await query<Permission[]>(
            'SELECT * FROM permissions ORDER BY category, name'
        );

        // Get permissions for each role
        const rolesWithPermissions = await Promise.all(
            roles.map(async (role) => {
                const rolePerms = await query<RolePermission[]>(
                    'SELECT permission_id FROM role_permissions WHERE role_id = ?',
                    [role.id]
                );
                return {
                    ...role,
                    permissions: rolePerms.map((rp) => rp.permission_id),
                };
            })
        );

        return NextResponse.json({ roles: rolesWithPermissions, permissions });
    } catch (error) {
        console.error('Error fetching roles:', error);
        return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
    }
}

// POST /api/roles - Create new role
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions) as ExtendedSession;

        if (!hasPermission(session, 'roles.manage')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const body = await request.json();
        const { name, description, permissions = [] } = body;

        if (!name) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        // Check if name already exists
        const existing = await queryOne<Role>(
            'SELECT id FROM roles WHERE name = ?',
            [name]
        );

        if (existing) {
            return NextResponse.json({ error: 'Role name already exists' }, { status: 400 });
        }

        const id = uuidv4();

        await query(
            'INSERT INTO roles (id, name, description, is_system) VALUES (?, ?, ?, false)',
            [id, name, description || null]
        );

        // Add permissions
        for (const permId of permissions) {
            await query(
                'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
                [id, permId]
            );
        }

        return NextResponse.json({ id, message: 'Role created successfully' });
    } catch (error) {
        console.error('Error creating role:', error);
        return NextResponse.json({ error: 'Failed to create role' }, { status: 500 });
    }
}
