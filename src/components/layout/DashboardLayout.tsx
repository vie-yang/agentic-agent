'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import {
    LayoutDashboard,
    Bot,
    MessageSquare,
    Settings,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Menu,
    X,
    LogOut,
    User,
    Shield,
    List,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SubNavItem {
    href: string;
    label: string;
    icon: React.ReactNode;
    exact?: boolean;
}

interface NavItem {
    href: string;
    label: string;
    icon: React.ReactNode;
    subItems?: SubNavItem[];
    exact?: boolean;
}

const navItems: NavItem[] = [
    { href: '/', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" />, exact: true },
    {
        href: '/agents',
        label: 'Agents',
        icon: <Bot className="h-5 w-5" />,
        subItems: [
            { href: '/agents', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" />, exact: true },
            { href: '/agents/list', label: 'Agent List', icon: <List className="h-4 w-4" /> },
            { href: '/agents/history', label: 'Chat History', icon: <MessageSquare className="h-4 w-4" /> },
        ],
    },
    { href: '/users', label: 'Users', icon: <User className="h-5 w-5" /> },
    { href: '/roles', label: 'Roles', icon: <Shield className="h-5 w-5" /> },
    { href: '/settings', label: 'Settings', icon: <Settings className="h-5 w-5" /> },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { data: session } = useSession();
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set(['/agents']));

    // Don't show layout for login page or setup page
    if (pathname === '/login' || pathname === '/setup') {
        return <>{children}</>;
    }

    const isActive = (href: string, exact = false) => {
        if (exact) return pathname === href;
        return pathname.startsWith(href) && (pathname === href || pathname[href.length] === '/');
    };

    const isParentActive = (item: NavItem) => {
        if (item.subItems) {
            // Check if any sub-item is active
            return item.subItems.some(sub => isActive(sub.href, sub.exact));
        }
        return isActive(item.href, item.exact);
    };

    const toggleMenu = (href: string) => {
        const newExpanded = new Set(expandedMenus);
        if (newExpanded.has(href)) {
            newExpanded.delete(href);
        } else {
            newExpanded.add(href);
        }
        setExpandedMenus(newExpanded);
    };

    const handleLogout = async () => {
        await signOut({ callbackUrl: '/login' });
    };

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Mobile Header */}
            <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-slate-200 flex items-center px-4 z-50 shadow-sm">
                <button
                    onClick={() => setMobileOpen(!mobileOpen)}
                    className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                >
                    {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
                <span className="ml-3 font-semibold text-slate-800">AI Platform</span>
            </div>

            {/* Mobile Overlay */}
            {mobileOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/30 z-40"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={cn(
                    "fixed top-0 left-0 h-full bg-slate-800 text-white transition-all duration-300 z-50 flex flex-col",
                    collapsed ? "w-16" : "w-64",
                    mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
                )}
            >
                {/* Logo */}
                <div className={cn(
                    "h-16 flex items-center border-b border-slate-700",
                    collapsed ? "justify-center px-2" : "px-5"
                )}>
                    <Bot className="h-7 w-7 text-blue-400 shrink-0" />
                    {!collapsed && (
                        <span className="ml-3 font-semibold text-lg">AI Platform</span>
                    )}
                </div>

                {/* Navigation */}
                <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
                    {navItems.map((item) => {
                        const hasSubItems = item.subItems && item.subItems.length > 0;
                        const isExpanded = expandedMenus.has(item.href);
                        const parentActive = isParentActive(item);

                        return (
                            <div key={item.href}>
                                {hasSubItems ? (
                                    <>
                                        <button
                                            onClick={() => toggleMenu(item.href)}
                                            className={cn(
                                                "flex items-center justify-between w-full px-3 py-2.5 rounded-lg transition-all duration-200",
                                                parentActive
                                                    ? "bg-blue-500/20 text-blue-400"
                                                    : "text-slate-300 hover:bg-slate-700/50 hover:text-white",
                                                collapsed && "justify-center px-2"
                                            )}
                                        >
                                            <div className="flex items-center gap-3">
                                                {item.icon}
                                                {!collapsed && <span className="font-medium">{item.label}</span>}
                                            </div>
                                            {!collapsed && (
                                                <ChevronDown
                                                    className={cn(
                                                        "h-4 w-4 transition-transform duration-200",
                                                        isExpanded ? "rotate-0" : "-rotate-90"
                                                    )}
                                                />
                                            )}
                                        </button>
                                        {isExpanded && !collapsed && (
                                            <div className="ml-4 mt-1 space-y-1 border-l border-slate-600 pl-3">
                                                {item.subItems!.map((subItem) => (
                                                    <Link
                                                        key={subItem.href}
                                                        href={subItem.href}
                                                        onClick={() => setMobileOpen(false)}
                                                        className={cn(
                                                            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200",
                                                            isActive(subItem.href, subItem.exact)
                                                                ? "bg-blue-500/20 text-blue-400"
                                                                : "text-slate-400 hover:bg-slate-700/50 hover:text-white"
                                                        )}
                                                    >
                                                        {subItem.icon}
                                                        <span>{subItem.label}</span>
                                                    </Link>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <Link
                                        href={item.href}
                                        onClick={() => setMobileOpen(false)}
                                        className={cn(
                                            "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                                            isActive(item.href, item.exact)
                                                ? "bg-blue-500/20 text-blue-400"
                                                : "text-slate-300 hover:bg-slate-700/50 hover:text-white",
                                            collapsed && "justify-center px-2"
                                        )}
                                    >
                                        {item.icon}
                                        {!collapsed && <span className="font-medium">{item.label}</span>}
                                    </Link>
                                )}
                            </div>
                        );
                    })}
                </nav>

                {/* User Info & Logout */}
                <div className="p-3 border-t border-slate-700 space-y-2">
                    {/* User Info */}
                    {session?.user && (
                        <div className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-700/30",
                            collapsed && "justify-center px-2"
                        )}>
                            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                                <User className="h-4 w-4 text-white" />
                            </div>
                            {!collapsed && (
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-white truncate">
                                        {session.user.name}
                                    </p>
                                    <p className="text-xs text-slate-400 truncate">
                                        {(session.user as { role?: string }).role || 'User'}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Logout Button */}
                    <button
                        onClick={handleLogout}
                        className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-slate-300 hover:bg-red-500/20 hover:text-red-400 transition-colors",
                            collapsed && "justify-center px-2"
                        )}
                    >
                        <LogOut className="h-5 w-5" />
                        {!collapsed && <span className="font-medium">Logout</span>}
                    </button>

                    {/* Collapse Toggle */}
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="hidden lg:flex items-center justify-center w-full p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-white transition-colors"
                    >
                        {collapsed ? (
                            <ChevronRight className="h-5 w-5" />
                        ) : (
                            <ChevronLeft className="h-5 w-5" />
                        )}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main
                className={cn(
                    "transition-all duration-300 min-h-screen",
                    collapsed ? "lg:ml-16" : "lg:ml-64",
                    "pt-14 lg:pt-0"
                )}
            >
                <div className="p-6 lg:p-8 max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
