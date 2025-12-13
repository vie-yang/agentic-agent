import type { Metadata } from "next";
import "./globals.css";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import AuthProvider from "@/components/AuthProvider";

export const metadata: Metadata = {
  title: "AgentForge AI - AI Chat Agent Builder",
  description: "Create and manage intelligent AI chat agents for your applications",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <DashboardLayout>
            {children}
          </DashboardLayout>
        </AuthProvider>
      </body>
    </html>
  );
}
