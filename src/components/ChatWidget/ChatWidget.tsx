'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User, Maximize2, Minimize2, Loader2, Wrench, Brain } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './ChatWidget.module.css';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

interface ThinkingStatus {
    isThinking: boolean;
    currentStep: string;
    iteration: number;
    toolName?: string;
    stepType?: 'thinking' | 'tool' | 'processing';
}

interface ChatWidgetProps {
    agentId: string;
    agentName?: string;
    apiUrl?: string;
}

export default function ChatWidget({
    agentId,
    agentName = 'AI Assistant',
    apiUrl = '/api/chat'
}: ChatWidgetProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [thinkingStatus, setThinkingStatus] = useState<ThinkingStatus>({
        isThinking: false,
        currentStep: '',
        iteration: 0,
    });
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, thinkingStatus]);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input.trim(),
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);
        setThinkingStatus({
            isThinking: true,
            currentStep: 'Starting...',
            iteration: 0,
            stepType: 'processing',
        });

        try {
            // Try streaming first
            const streamResponse = await fetch(`${apiUrl}/${agentId}/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [...messages, userMessage].map((m) => ({
                        role: m.role,
                        content: m.content,
                    })),
                }),
            });

            if (streamResponse.ok && streamResponse.body) {
                // Use streaming
                const reader = streamResponse.body.getReader();
                const decoder = new TextDecoder();
                let finalContent = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n');

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.slice(6));

                                if (data.type === 'iteration_start') {
                                    setThinkingStatus({
                                        isThinking: true,
                                        currentStep: `Analyzing request...`,
                                        iteration: data.iteration || 1,
                                        stepType: 'thinking',
                                    });
                                } else if (data.type === 'thinking') {
                                    // Extract first line or summary of thinking
                                    const thinkingText = data.content || '';
                                    const firstLine = thinkingText.split('\n')[0].slice(0, 100);
                                    setThinkingStatus({
                                        isThinking: true,
                                        currentStep: firstLine || 'Thinking...',
                                        iteration: data.iteration || 1,
                                        stepType: 'thinking',
                                    });
                                } else if (data.type === 'tool_call') {
                                    setThinkingStatus({
                                        isThinking: true,
                                        currentStep: `Calling ${data.toolName}...`,
                                        iteration: data.iteration || 1,
                                        toolName: data.toolName,
                                        stepType: 'tool',
                                    });
                                } else if (data.type === 'tool_result') {
                                    setThinkingStatus({
                                        isThinking: true,
                                        currentStep: `Processing ${data.toolName} result...`,
                                        iteration: data.iteration || 1,
                                        toolName: data.toolName,
                                        stepType: 'processing',
                                    });
                                } else if (data.type === 'content') {
                                    setThinkingStatus({
                                        isThinking: true,
                                        currentStep: 'Generating response...',
                                        iteration: data.iteration || 1,
                                        stepType: 'processing',
                                    });
                                } else if (data.type === 'complete') {
                                    finalContent = data.finalResponse || '';
                                } else if (data.type === 'error') {
                                    finalContent = data.content || 'An error occurred';
                                }
                            } catch {
                                // Ignore parse errors
                            }
                        }
                    }
                }

                if (finalContent) {
                    const assistantMessage: Message = {
                        id: (Date.now() + 1).toString(),
                        role: 'assistant',
                        content: finalContent,
                        timestamp: new Date(),
                    };
                    setMessages((prev) => [...prev, assistantMessage]);
                }
            } else {
                // Fallback to non-streaming
                setThinkingStatus({
                    isThinking: true,
                    currentStep: 'Processing your request...',
                    iteration: 1,
                    stepType: 'processing',
                });

                const response = await fetch(`${apiUrl}/${agentId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        messages: [...messages, userMessage].map((m) => ({
                            role: m.role,
                            content: m.content,
                        })),
                    }),
                });

                if (!response.ok) throw new Error('Failed to get response');

                const data = await response.json();

                const assistantMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: data.message,
                    timestamp: new Date(),
                };

                setMessages((prev) => [...prev, assistantMessage]);
            }
        } catch (error) {
            console.error('Chat error:', error);
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.',
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
            setThinkingStatus({
                isThinking: false,
                currentStep: '',
                iteration: 0,
            });
        }
    };

    const toggleMaximize = () => {
        setIsMaximized(!isMaximized);
    };

    return (
        <div className={`${styles.container} ${isMaximized ? styles.maximized : ''}`}>
            {/* Chat Window */}
            {isOpen && (
                <div className={`${styles.window} ${isMaximized ? styles.windowMaximized : ''}`}>
                    {/* Header */}
                    <div className={styles.header}>
                        <div className={styles.headerInfo}>
                            <div className={styles.headerIcon}>
                                <Bot size={20} />
                            </div>
                            <div>
                                <div className={styles.headerTitle}>{agentName}</div>
                                <div className={styles.headerStatus}>
                                    <span className={styles.statusDot}></span>
                                    Online
                                </div>
                            </div>
                        </div>
                        <div className={styles.headerActions}>
                            <button
                                className={styles.headerButton}
                                onClick={toggleMaximize}
                                aria-label={isMaximized ? 'Minimize chat' : 'Maximize chat'}
                                title={isMaximized ? 'Minimize' : 'Maximize'}
                            >
                                {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                            </button>
                            <button
                                className={styles.headerButton}
                                onClick={() => {
                                    setIsOpen(false);
                                    setIsMaximized(false);
                                }}
                                aria-label="Close chat"
                                title="Close"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className={styles.messages}>
                        {messages.length === 0 && !isLoading && (
                            <div className={styles.emptyState}>
                                <Bot size={48} />
                                <p>How can I help you today?</p>
                            </div>
                        )}
                        {messages.map((message) => (
                            <div
                                key={message.id}
                                className={`${styles.message} ${message.role === 'user' ? styles.userMessage : styles.assistantMessage
                                    }`}
                            >
                                <div className={styles.messageAvatar}>
                                    {message.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                                </div>
                                <div className={styles.messageContent}>
                                    {message.role === 'assistant' ? (
                                        <div className={styles.markdown}>
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {message.content}
                                            </ReactMarkdown>
                                        </div>
                                    ) : (
                                        message.content
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Thinking Status */}
                        {isLoading && thinkingStatus.isThinking && (
                            <div className={`${styles.message} ${styles.assistantMessage}`}>
                                <div className={styles.messageAvatar}>
                                    <Bot size={16} />
                                </div>
                                <div className={styles.thinkingContent}>
                                    <div className={styles.thinkingHeader}>
                                        {thinkingStatus.stepType === 'tool' ? (
                                            <Wrench size={14} className={styles.thinkingIcon} />
                                        ) : thinkingStatus.stepType === 'thinking' ? (
                                            <Brain size={14} className={styles.thinkingIcon} />
                                        ) : (
                                            <Loader2 size={14} className={styles.spinningIcon} />
                                        )}
                                        <span className={styles.thinkingLabel}>
                                            {thinkingStatus.stepType === 'tool'
                                                ? 'Using Tool'
                                                : thinkingStatus.stepType === 'thinking'
                                                    ? 'Thinking'
                                                    : 'Processing'}
                                        </span>
                                        {thinkingStatus.iteration > 0 && (
                                            <span className={styles.thinkingIteration}>
                                                Step {thinkingStatus.iteration}
                                            </span>
                                        )}
                                    </div>
                                    <div className={styles.thinkingStep}>
                                        {thinkingStatus.currentStep}
                                    </div>
                                    <div className={styles.thinkingDots}>
                                        <span></span>
                                        <span></span>
                                        <span></span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <form className={styles.inputForm} onSubmit={handleSubmit}>
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Type your message..."
                            className={styles.input}
                            disabled={isLoading}
                        />
                        <button
                            type="submit"
                            className={styles.sendButton}
                            disabled={!input.trim() || isLoading}
                        >
                            <Send size={18} />
                        </button>
                    </form>
                </div>
            )}

            {/* Toggle Button */}
            {!isMaximized && (
                <button
                    className={styles.toggleButton}
                    onClick={() => setIsOpen(!isOpen)}
                    aria-label={isOpen ? 'Close chat' : 'Open chat'}
                >
                    {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
                </button>
            )}
        </div>
    );
}
