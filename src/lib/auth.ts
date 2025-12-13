import NextAuth, { NextAuthOptions, Session, User } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { queryOne, query } from './db';
import { JWT } from 'next-auth/jwt';

interface DBUser {
    id: string;
    email: string;
    password_hash: string;
    name: string;
    role_id: string;
    role_name: string;
    is_active: boolean;
}

interface Permission {
    code: string;
}

export interface ExtendedUser extends User {
    id: string;
    email: string;
    name: string;
    role: string;
    roleId: string;
    permissions: string[];
}

export interface ExtendedSession extends Session {
    user: ExtendedUser;
}

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials): Promise<ExtendedUser | null> {
                if (!credentials?.email || !credentials?.password) {
                    return null;
                }

                try {
                    // Get user with role
                    const user = await queryOne<DBUser>(
                        `SELECT u.*, r.name as role_name 
                         FROM users u 
                         LEFT JOIN roles r ON u.role_id = r.id 
                         WHERE u.email = ? AND u.is_active = true`,
                        [credentials.email]
                    );

                    if (!user) {
                        return null;
                    }

                    // Verify password
                    const isValid = await bcrypt.compare(credentials.password, user.password_hash);
                    if (!isValid) {
                        return null;
                    }

                    // Get user permissions
                    const permissions = await query<Permission[]>(
                        `SELECT p.code 
                         FROM permissions p 
                         INNER JOIN role_permissions rp ON p.id = rp.permission_id 
                         WHERE rp.role_id = ?`,
                        [user.role_id]
                    );

                    // Update last login
                    await query(
                        'UPDATE users SET last_login = NOW() WHERE id = ?',
                        [user.id]
                    );

                    return {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        role: user.role_name || 'User',
                        roleId: user.role_id,
                        permissions: permissions.map(p => p.code),
                    };
                } catch (error) {
                    console.error('Auth error:', error);
                    return null;
                }
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }): Promise<JWT> {
            if (user) {
                const extUser = user as ExtendedUser;
                token.id = extUser.id;
                token.role = extUser.role;
                token.roleId = extUser.roleId;
                token.permissions = extUser.permissions;
            }
            return token;
        },
        async session({ session, token }): Promise<ExtendedSession> {
            return {
                ...session,
                user: {
                    ...session.user,
                    id: token.id as string,
                    role: token.role as string,
                    roleId: token.roleId as string,
                    permissions: token.permissions as string[],
                },
            } as ExtendedSession;
        },
    },
    pages: {
        signIn: '/login',
    },
    session: {
        strategy: 'jwt',
        maxAge: 24 * 60 * 60, // 24 hours
    },
    secret: process.env.NEXTAUTH_SECRET || 'agentforge-secret-key-change-in-production',
};

export default NextAuth(authOptions);

// Helper to check permission
export function hasPermission(session: ExtendedSession | null, permission: string): boolean {
    if (!session?.user?.permissions) return false;
    return session.user.permissions.includes(permission);
}

// Helper to check multiple permissions (any)
export function hasAnyPermission(session: ExtendedSession | null, permissions: string[]): boolean {
    if (!session?.user?.permissions) return false;
    return permissions.some(p => session.user.permissions.includes(p));
}

// Helper to check if user is superadmin
export function isSuperadmin(session: ExtendedSession | null): boolean {
    return session?.user?.role === 'Superadmin';
}
