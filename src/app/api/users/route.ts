import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth';
import { authOptions, hasPermission, ExtendedSession } from '@/lib/auth';

interface User {
    id: string;
    email: string;
    name: string;
    role_id: string;
    role_name: string;
    is_active: boolean;
    last_login: string | null;
    created_at: string;
}

interface Role {
    id: string;
    name: string;
}

// GET /api/users - Get all users
export async function GET() {
    try {
        const session = await getServerSession(authOptions) as ExtendedSession;

        if (!hasPermission(session, 'users.view')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const users = await query<User[]>(
            `SELECT u.id, u.email, u.name, u.role_id, r.name as role_name, 
                    u.is_active, u.last_login, u.created_at
             FROM users u
             LEFT JOIN roles r ON u.role_id = r.id
             ORDER BY u.created_at DESC`
        );

        const roles = await query<Role[]>('SELECT id, name FROM roles ORDER BY name');

        return NextResponse.json({ users, roles });
    } catch (error) {
        console.error('Error fetching users:', error);
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }
}

// POST /api/users - Create new user
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions) as ExtendedSession;

        if (!hasPermission(session, 'users.manage')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const body = await request.json();
        const { email, password, name, role_id, is_active = true } = body;

        if (!email || !password || !name) {
            return NextResponse.json(
                { error: 'Email, password, and name are required' },
                { status: 400 }
            );
        }

        // Check if email already exists
        const existing = await queryOne<User>(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (existing) {
            return NextResponse.json(
                { error: 'Email already exists' },
                { status: 400 }
            );
        }

        const id = uuidv4();
        const password_hash = await bcrypt.hash(password, 10);

        await query(
            `INSERT INTO users (id, email, password_hash, name, role_id, is_active)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [id, email, password_hash, name, role_id || null, is_active]
        );

        return NextResponse.json({ id, message: 'User created successfully' });
    } catch (error) {
        console.error('Error creating user:', error);
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }
}
