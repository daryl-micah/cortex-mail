'use client';

import { useCallback, useState } from 'react';
import { useAppSelector } from '@/store';
import {
  dispatchAgentActions,
  dispatchAssistantAction,
} from '@/lib/assistantDispatcher';
import type { AgentAction } from '@/lib/schemas';

/**
 * Single-shot "ask Cortex" round-trip shared by the search palette and the
 * thread drawer. Sends one message through the ReAct agent, dispatches any
 * resulting UI actions, and surfaces the send-confirmation flow.
 */
export function useAskCortex() {
  const detailEmailId = useAppSelector((state) => state.ui.detailEmailId);
  const compose = useAppSelector((state) => state.mail.compose);

  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const reset = useCallback(() => {
    setAsking(false);
    setAnswer(null);
    setError('');
    setShowConfirmDialog(false);
  }, []);

  const ask = useCallback(
    async (message: string) => {
      const q = message.trim();
      if (!q || asking) return;
      setAnswer(null);
      setError('');
      setAsking(true);

      try {
        const res = await fetch('/api/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: q,
            conversationHistory: [],
            context: { selectedEmailId: detailEmailId },
          }),
        });

        const data = await res.json();
        if (data.error) {
          setError(data.error);
          return;
        }

        const { needsConfirmation } = dispatchAgentActions(
          (data.actions ?? []) as AgentAction[]
        );
        if (needsConfirmation) setShowConfirmDialog(true);

        setAnswer(data.message ?? 'Done.');
      } catch {
        setError('Sorry, something went wrong. Please try again.');
      } finally {
        setAsking(false);
      }
    },
    [asking, detailEmailId]
  );

  const confirmSend = useCallback(async () => {
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
        setAnswer('✓ Email sent successfully!');
        dispatchAssistantAction({ type: 'SEND_EMAIL_CONFIRMED' });
      } else {
        setAnswer('✗ Failed to send email');
      }
    } catch {
      setAnswer('✗ Error sending email');
    }
  }, [compose]);

  const cancelSend = useCallback(() => {
    setShowConfirmDialog(false);
    setAnswer('Email sending cancelled.');
  }, []);

  return {
    ask,
    asking,
    answer,
    error,
    showConfirmDialog,
    confirmSend,
    cancelSend,
    reset,
    compose,
  };
}
