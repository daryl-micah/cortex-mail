'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppDispatch, useAppSelector } from '@/store';
import { setCompose, sendEmail, clearCompose } from '@/store/mailSlice';
import { setView } from '@/store/uiSlice';
import { Pencil } from 'lucide-react';
import { useState } from 'react';

export default function ComposeForm() {
  const dispatch = useAppDispatch();
  const compose = useAppSelector((state) => state.mail.compose);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    if (!compose.to || !compose.subject) return;

    try {
      setSending(true);
      setError(null);

      const response = await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: compose.to,
          subject: compose.subject,
          body: compose.body,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send email');
      }

      dispatch(sendEmail());
      dispatch(setView('INBOX'));
    } catch (err) {
      console.error('Error sending email:', err);
      setError('Failed to send email. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    dispatch(clearCompose());
    dispatch(setView('INBOX'));
    setError(null);
  };

  return (
    <div className="flex flex-col h-full">
      <header className="p-3 border-b flex justify-between items-center">
        <span className="font-semibold">
          {' '}
          <Pencil className="inline-block mr-2 h-5 text-blue-600" /> New Message
        </span>
        <Button
          className="w-8 h-8 hover:bg-red-100"
          variant="ghost"
          size="sm"
          onClick={handleClose}
        >
          ✕
        </Button>
      </header>

      <div className="p-3 space-y-2">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
            {error}
          </div>
        )}
        <Input
          placeholder="To"
          value={compose.to}
          onChange={(e) => dispatch(setCompose({ to: e.target.value }))}
        />

        <Input
          placeholder="Subject"
          value={compose.subject}
          onChange={(e) => dispatch(setCompose({ subject: e.target.value }))}
        />
      </div>

      <textarea
        className="flex-1 p-3 resize-none bg-background border-0 focus:outline-none min-h-72 min-w-2xl"
        placeholder="Write your message..."
        value={compose.body}
        onChange={(e) => dispatch(setCompose({ body: e.target.value }))}
      />

      <footer className="p-3 border-t flex justify-between">
        <Button variant="outline" onClick={handleClose} disabled={sending}>
          Discard
        </Button>
        <Button
          disabled={!compose.to || !compose.subject || sending}
          onClick={handleSend}
        >
          {sending ? 'Sending...' : 'Send'}
        </Button>
      </footer>
    </div>
  );
}
