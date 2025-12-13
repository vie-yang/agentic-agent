import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
    title: "Login - AgentForge AI",
    description: "Sign in to AgentForge AI",
};

export default function LoginLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return children;
}
