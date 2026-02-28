import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// CORS configuration
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:8080',
    'http://localhost:5173', // Vite default
    'http://localhost:4200', // Angular default
    'http://127.0.0.1:3000',
    'http://127.0.0.1:8080',
];

// Allow all origins in development
const isDevelopment = process.env.NODE_ENV !== 'production';

// Public paths that don't require authentication
const publicPaths = [
    '/login',
    '/api/auth',
    '/api/chat', // Widget API
    '/api/init',
    '/api/agents/export', // Export API (called internally by AI agent)
    '/widget.js',
    '/agents/embed', // Public agent embed
    '/api/sessions', // Public access for sessions (protected by internal logic)
];

function getCorsHeaders(origin: string | null): Record<string, string> {
    // In development, allow any origin
    if (isDevelopment) {
        return {
            'Access-Control-Allow-Origin': origin || '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Max-Age': '86400',
        };
    }

    // In production, check allowed origins
    if (origin && allowedOrigins.includes(origin)) {
        return {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Max-Age': '86400',
        };
    }

    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    };
}

function isPublicPath(pathname: string): boolean {
    return publicPaths.some(path => pathname.startsWith(path));
}

// Configure which paths the middleware runs on
export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|widget.js).*)',
    ],
};

export async function middleware(request: NextRequest) {
    const origin = request.headers.get('origin');
    const { pathname } = request.nextUrl;

    // SETUP CHECK
    const isSetupCompleted = process.env.SETUP_COMPLETED === 'true';
    const isSetupPage = pathname === '/setup' || pathname.startsWith('/api/setup');

    // If setup is NOT completed, enforce redirection to /setup
    // But allow Next.js internals, static files, setup page, AND API routes
    // (Allowing API routes prevents 'Unexpected token <' errors when client checks session)
    if (!isSetupCompleted) {
        // Allow setup page, Next.js internals, static files, AND API routes (to prevent HTML response for JSON fetch)
        if (!isSetupPage && !pathname.startsWith('/_next') && !pathname.includes('.') && !pathname.startsWith('/api/')) {
            return NextResponse.redirect(new URL('/setup', request.url));
        }
    }
    // If setup IS completed, block access to /setup
    else if (isSetupPage) {
        return NextResponse.redirect(new URL('/', request.url));
    }

    // Handle CORS for API routes
    if (pathname.startsWith('/api/')) {
        const corsHeaders = getCorsHeaders(origin);

        // Handle preflight OPTIONS request
        if (request.method === 'OPTIONS') {
            return new NextResponse(null, {
                status: 204,
                headers: corsHeaders,
            });
        }

        // For public API routes, just add CORS headers
        if (isPublicPath(pathname) || pathname.startsWith('/api/setup')) {
            const response = NextResponse.next();
            Object.entries(corsHeaders).forEach(([key, value]) => {
                response.headers.set(key, value);
            });
            return response;
        }

        // For protected API routes, check authentication
        const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET || 'agentforge-secret-key-change-in-production' });

        if (!token) {
            return new NextResponse(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
            );
        }

        const response = NextResponse.next();
        Object.entries(corsHeaders).forEach(([key, value]) => {
            response.headers.set(key, value);
        });
        return response;
    }

    // Skip auth check for public paths (+ setup page if we got here)
    if (isPublicPath(pathname) || pathname === '/setup') {
        const response = NextResponse.next();
        // For embed routes, allow iframe embedding by removing X-Frame-Options
        // and setting a permissive CSP frame-ancestors.
        // Domain validation is handled by the embed page itself via referer check.
        if (pathname.startsWith('/agents/embed')) {
            response.headers.delete('X-Frame-Options');
            response.headers.set('Content-Security-Policy', 'frame-ancestors *');
        }
        return response;
    }

    // Skip auth check for static files
    if (
        pathname.startsWith('/_next') ||
        pathname.includes('.') // Files with extension (images, etc)
    ) {
        return NextResponse.next();
    }

    // Check authentication for protected pages
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET || 'agentforge-secret-key-change-in-production' });

    if (!token) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('callbackUrl', pathname);
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}
