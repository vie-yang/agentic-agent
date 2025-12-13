import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth';
import { authOptions, hasPermission, ExtendedSession } from '@/lib/auth';

interface User {
    id: string;
    email: string;
}

// GET /api/users/[id] - Get single user
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions) as ExtendedSession;

        if (!hasPermission(session, 'users.view')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { id } = await params;

        const user = await queryOne(
            `SELECT u.id, u.email, u.name, u.role_id, r.name as role_name, 
                    u.is_active, u.last_login, u.created_at
             FROM users u
             LEFT JOIN roles r ON u.role_id = r.id
             WHERE u.id = ?`,
            [id]
        );

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
    }
}

// PUT /api/users/[id] - Update user
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions) as ExtendedSession;

        if (!hasPermission(session, 'users.manage')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { id } = await params;
        const body = await request.json();
        const { email, password, name, role_id, is_active } = body;

        // Check if user exists
        const existing = await queryOne<User>('SELECT id FROM users WHERE id = ?', [id]);
        if (!existing) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Check if new email conflicts with another user
        if (email) {
            const emailConflict = await queryOne<User>(
                'SELECT id FROM users WHERE email = ? AND id != ?',
                [email, id]
            );
            if (emailConflict) {
                return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
            }
        }

        // Build update query
        const updates: string[] = [];
        const values: unknown[] = [];

        if (email) {
            updates.push('email = ?');
            values.push(email);
        }
        if (name) {
            updates.push('name = ?');
            values.push(name);
        }
        if (password) {
            updates.push('password_hash = ?');
            values.push(await bcrypt.hash(password, 10));
        }
        if (role_id !== undefined) {
            updates.push('role_id = ?');
            values.push(role_id || null);
        }
        if (is_active !== undefined) {
            updates.push('is_active = ?');
            values.push(is_active);
        }

        if (updates.length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        values.push(id);
        await query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);

        return NextResponse.json({ message: 'User updated successfully' });
    } catch (error) {
        console.error('Error updating user:', error);
        return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }
}

// DELETE /api/users/[id] - Delete user
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions) as ExtendedSession;

        if (!hasPermission(session, 'users.manage')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { id } = await params;

        // Prevent deleting yourself
        if (session.user?.id === id) {
            return NextResponse.json(
                { error: 'Cannot delete your own account' },
                { status: 400 }
            );
        }

        await query('DELETE FROM users WHERE id = ?', [id]);

        return NextResponse.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
    }
}
