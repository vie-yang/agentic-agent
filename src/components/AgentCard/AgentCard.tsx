'use client';

import Link from 'next/link';
import { Bot, MoreVertical, Calendar } from 'lucide-react';

interface Agent {
    id: string;
    name: string;
    description: string | null;
    status: 'active' | 'inactive' | 'draft';
    created_at: string;
    updated_at: string;
}

interface AgentCardProps {
    agent: Agent;
}

const statusLabels: Record<string, { label: string; className: string }> = {
    active: { label: 'Active', className: 'badge-success' },
    inactive: { label: 'Inactive', className: 'badge-neutral' },
    draft: { label: 'Draft', className: 'badge-warning' },
};

export default function AgentCard({ agent }: AgentCardProps) {
    const status = statusLabels[agent.status] || statusLabels.draft;

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    return (
        <Link href={`/agents/${agent.id}`} className="agent-card">
            <div className="agent-card-header">
                <div className="agent-card-icon">
                    <Bot size={24} />
                </div>
                <span className={`badge ${status.className}`}>{status.label}</span>
            </div>

            <h3 className="agent-card-title">{agent.name}</h3>
            <p className="agent-card-description">
                {agent.description || 'No description provided'}
            </p>

            <div className="agent-card-footer">
                <div className="agent-card-meta flex items-center gap-2">
                    <Calendar size={14} />
                    <span>Created {formatDate(agent.created_at)}</span>
                </div>
            </div>
        </Link>
    );
}
