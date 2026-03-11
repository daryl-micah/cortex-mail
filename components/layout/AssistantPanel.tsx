'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ConfirmSendDialog from '@/components/ui/ConfirmSendDialog';
import {
  dispatchAgentActions,
  dispatchAssistantAction,
} from '@/lib/assistantDispatcher';
import { useAppSelector } from '@/store';
import {
  ChevronDown,
  ChevronRight,
  MessageSquareOff,
  Send,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import type { AgentStep, AgentAction } from '@/lib/schemas';
import type { ContextMessage } from '@/lib/contextBuilder';

const STORAGE_KEY = 'cortex-chat-history';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  /** ReAct reasoning steps — only present on assistant messages */
  steps?: AgentStep[];
}

export default function AssistantPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const selectedEmailId = useAppSelector((state) => state.ui.selectedEmailId);
  const compose = useAppSelector((state) => state.mail.compose);

  // Restore conversation from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setMessages(JSON.parse(saved));
    } catch {
      /* ignore parse errors */
    }
  }, []);

  // Persist conversation to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      /* ignore quota errors */
    }
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Ctrl+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);

    const updatedMessages: Message[] = [
      ...messages,
      { role: 'user', content: userMessage },
    ];
    setMessages(updatedMessages);

    try {
      // Build conversation history for multi-turn context (exclude steps)
      const conversationHistory: ContextMessage[] = updatedMessages.map(
        (m) => ({
          role: m.role,
          content: m.content,
        })
      );

      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          conversationHistory: conversationHistory.slice(0, -1), // exclude the just-added user message (agent adds it itself)
          context: { selectedEmailId },
        }),
      });

      const data = await response.json();

      if (data.error) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `Error: ${data.error}` },
        ]);
        return;
      }

      // Dispatch UI actions from agent (compose, filter, open, etc.)
      const { needsConfirmation } = dispatchAgentActions(
        (data.actions ?? []) as AgentAction[]
      );

      if (needsConfirmation) {
        setShowConfirmDialog(true);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.message ?? 'Done.',
          steps: data.steps ?? [],
        },
      ]);
    } catch (error) {
      console.error('Assistant error:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClear = () => {
    setMessages([]);
    setExpandedSteps(new Set());
    localStorage.removeItem(STORAGE_KEY);
  };

  const toggleSteps = (index: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  };

  return (
    <aside className="border-l border-border h-screen flex flex-col bg-background">
      <div className="flex flex-row justify-between p-4 border-b">
        <div>
          <h2 className="text-sm font-semibold">AI Assistant</h2>
          <p className="text-xs text-muted-foreground mt-1">
            I can help you manage emails
          </p>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            className="hover:bg-red-100 cursor-pointer"
            title="Clear Chat"
            onClick={handleClear}
          >
            <MessageSquareOff />
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-sm text-muted-foreground space-y-2">
            <p className="font-medium">Try asking:</p>
            <ul className="text-xs space-y-1 ml-2">
              <li>• &quot;Find emails about the project deadline&quot;</li>
              <li>
                • &quot;Read the latest email from John and summarise it&quot;
              </li>
              <li>• &quot;Draft a reply thanking them&quot;</li>
              <li>• &quot;Show unread emails&quot;</li>
              <li>• &quot;Send email to john@test.com about lunch&quot;</li>
            </ul>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i}>
            <div
              className={`text-sm p-2.5 rounded-lg ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground ml-4'
                  : 'bg-muted mr-4'
              }`}
            >
              {msg.content}
            </div>

            {/* Reasoning steps disclosure — only on assistant messages with steps */}
            {msg.role === 'assistant' && msg.steps && msg.steps.length > 0 && (
              <div className="mr-4 mt-1">
                <button
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => toggleSteps(i)}
                >
                  {expandedSteps.has(i) ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  {msg.steps.length} reasoning step
                  {msg.steps.length !== 1 ? 's' : ''}
                </button>

                {expandedSteps.has(i) && (
                  <div className="mt-1 space-y-1 pl-2 border-l border-border">
                    {msg.steps.map((step, j) => (
                      <div
                        key={j}
                        className="text-xs text-muted-foreground space-y-0.5"
                      >
                        <p>
                          <span className="font-medium text-foreground">
                            Thought:
                          </span>{' '}
                          {step.thought}
                        </p>
                        {step.action && (
                          <p>
                            <span className="font-medium text-foreground">
                              →
                            </span>{' '}
                            <span className="font-mono bg-muted px-1 rounded">
                              {step.action}
                            </span>
                          </p>
                        )}
                        {step.observation && (
                          <p className="text-muted-foreground/70 truncate">
                            <span className="font-medium text-muted-foreground">
                              Obs:
                            </span>{' '}
                            {step.observation.length > 120
                              ? step.observation.slice(0, 120) + '…'
                              : step.observation}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="text-sm p-2.5 rounded-lg bg-muted mr-4">
            <span className="animate-pulse">Thinking...</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {showConfirmDialog && (
        <ConfirmSendDialog
          to={compose.to}
          subject={compose.subject}
          body={compose.body}
          onConfirm={async () => {
            setShowConfirmDialog(false);
            try {
              const response = await fetch('/api/emails/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  to: compose.to,
                  subject: compose.subject,
                  body: compose.body,
                }),
              });

              if (response.ok) {
                setMessages((prev) => [
                  ...prev,
                  { role: 'assistant', content: '✓ Email sent successfully!' },
                ]);
                dispatchAssistantAction({ type: 'SEND_EMAIL_CONFIRMED' });
              } else {
                setMessages((prev) => [
                  ...prev,
                  { role: 'assistant', content: '✗ Failed to send email' },
                ]);
              }
            } catch (error) {
              setMessages((prev) => [
                ...prev,
                { role: 'assistant', content: '✗ Error sending email' },
              ]);
            }
          }}
          onCancel={() => {
            setShowConfirmDialog(false);
            setMessages((prev) => [
              ...prev,
              { role: 'assistant', content: 'Email sending cancelled.' },
            ]);
          }}
        />
      )}

      <div className="p-3 border-t flex gap-2">
        <Input
          ref={inputRef}
          placeholder="Type a command... (Ctrl+K)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={loading}
        />
        <Button
          size="icon"
          onClick={handleSendMessage}
          disabled={loading || !input.trim()}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </aside>
  );
}
