'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { dispatchAssistantAction } from '@/lib/assistantDispatcher';
import { useAppSelector } from '@/store';
import { MessageSquareOff, Send } from 'lucide-react';
import { useState } from 'react';
import type { AssistantAction } from '@/types/assistant';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function AssistantPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const emails = useAppSelector((state) => state.mail.emails);
  const filters = useAppSelector((state) => state.mail.filters);
  const currentView = useAppSelector((state) => state.ui.view);
  const selectedEmailId = useAppSelector((state) => state.ui.selectedEmailId);

  const handleSendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      // Build context for AI
      const context = {
        emails: emails.map((e) => ({
          id: e.id,
          from: e.from,
          subject: e.subject,
          preview: e.preview,
          date: e.date,
          unread: e.unread,
        })),
        currentView,
        selectedEmailId,
        filters,
      };

      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, context }),
      });

      const data = await response.json();

      if (data.actions && Array.isArray(data.actions)) {
        // Execute each action and collect responses
        const results: string[] = [];
        for (const action of data.actions as AssistantAction[]) {
          const result = dispatchAssistantAction(action);
          results.push(result);
        }

        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: results.join('\n'),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.message || 'Action completed',
          },
        ]);
      }
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

  return (
    <aside className="border-l border-border h-full flex flex-col bg-background">
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
            className="hover:bg-red-100"
            onClick={() => setMessages([])}
          >
            Clear
            <MessageSquareOff />
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-sm text-muted-foreground space-y-2">
            <p className="font-medium">Try asking:</p>
            <ul className="text-xs space-y-1 ml-2">
              <li>• &quot;Open compose view&quot;</li>
              <li>• &quot;Show unread emails&quot;</li>
              <li>• &quot;Open the latest email&quot;</li>
              <li>• &quot;Send email to john@test.com&quot;</li>
            </ul>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`text-sm p-2.5 rounded-lg ${
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground ml-4'
                : 'bg-muted mr-4'
            }`}
          >
            {msg.content}
          </div>
        ))}

        {loading && (
          <div className="text-sm p-2.5 rounded-lg bg-muted mr-4 animate-pulse">
            Thinking...
          </div>
        )}
      </div>

      <div className="p-3 border-t flex gap-2">
        <Input
          placeholder="Type a command..."
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
