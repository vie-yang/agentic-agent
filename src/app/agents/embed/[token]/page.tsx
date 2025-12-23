import { queryOne } from '@/lib/db';
import ChatWidget from '@/components/ChatWidget/ChatWidget';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';

interface Agent {
    id: string;
    name: string;
    embed_token: string;
    description: string | null;
}

async function getAgentByToken(token: string): Promise<Agent | null> {
    return queryOne<Agent>(
        'SELECT id, name, embed_token, description FROM agents WHERE embed_token = ? AND status = "active"',
        [token]
    );
}

export async function generateMetadata({ 
    params 
}: { 
    params: Promise<{ token: string }> 
}): Promise<Metadata> {
    const { token } = await params;
    const agent = await getAgentByToken(token);

    return {
        title: agent ? `${agent.name} - Chat` : 'Chat Assistant',
        description: agent?.description || 'AI Chat Assistant',
        viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0',
    };
}

export default async function EmbedPage({
    params,
    searchParams
}: {
    params: Promise<{ token: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const { token } = await params;
    const sParams = await searchParams;
    const agent = await getAgentByToken(token);

    if (!agent) {
        notFound();
    }

    // specific helper to get string param
    const getParam = (key: string): string | undefined => {
        const val = sParams[key];
        return typeof val === 'string' ? val : undefined;
    };

    // Helper to format color (add # if missing)
    const formatColor = (color?: string): string | undefined => {
        if (!color) return undefined;
        return color.startsWith('#') ? color : `#${color}`;
    };

    // Extract customization from search params (support camelCase and kebab-case)
    const title = getParam('title');
    const subtitle = getParam('subtitle');
    
    // Visuals
    const primaryColor = formatColor(getParam('primaryColor') || getParam('primary-color'));
    const secondaryColor = formatColor(getParam('secondaryColor') || getParam('secondary-color'));
    const textColor = formatColor(getParam('textColor') || getParam('text-color'));
    const bgColor = formatColor(getParam('bgColor') || getParam('bg-color'));
    const logoUrl = getParam('logoUrl') || getParam('logo-url');
    const avatarUrl = getParam('avatarUrl') || getParam('avatar-url');

    // Text
    const welcomeMessage = getParam('welcomeMessage') || getParam('welcome-message');
    const placeholder = getParam('placeholder');

    // Client Info
    const clientId = getParam('clientId') || getParam('client-id');
    const clientName = getParam('clientName') || getParam('client-name');
    const clientLevel = getParam('clientLevel') || getParam('client-level');

    return (
        <main className="w-full h-screen h-[100dvh]">
            <ChatWidget 
                agentId={agent.id} 
                agentName={agent.name} 
                isEmbed={true}
                token={agent.embed_token}
                title={title}
                subtitle={subtitle}
                primaryColor={primaryColor}
                secondaryColor={secondaryColor}
                textColor={textColor}
                bgColor={bgColor}
                logoUrl={logoUrl}
                avatarUrl={avatarUrl}
                welcomeMessage={welcomeMessage}
                placeholder={placeholder}
                clientId={clientId}
                clientName={clientName}
                clientLevel={clientLevel}
            />
        </main>
    );
}
