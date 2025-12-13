import { Session } from 'next-auth';

// Extended session type for client-side use
export interface ExtendedUser {
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

// Helper to check permission (client-safe)
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
