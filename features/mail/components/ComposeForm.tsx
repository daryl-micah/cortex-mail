'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppDispatch, useAppSelector } from '@/store';
import { setCompose, sendEmail, clearCompose } from '@/store/mailSlice';
import { closeCompose } from '@/store/uiSlice';
import { Pencil, X } from 'lucide-react';
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
      dispatch(closeCompose());
    } catch (err) {
      console.error('Error sending email:', err);
      setError('Failed to send email. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    dispatch(clearCompose());
    dispatch(closeCompose());
    setError(null);
  };

  return (
    <div className="flex flex-col h-full">
      <header className="p-3 border-b border-border flex justify-between items-center">
        <span className="font-semibold text-sm flex items-center">
          <Pencil className="inline-block mr-2 h-4 w-4 text-accent" /> New Message
        </span>
        <Button variant="ghost" size="icon-sm" onClick={handleClose} aria-label="Close">
          <X className="h-4 w-4" />
        </Button>
      </header>

      <div className="p-3 space-y-2">
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-2 rounded-md bevel">
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
        className="flex-1 p-3 resize-none bg-background border-0 focus:outline-none min-h-48 sm:min-h-72 w-full text-sm"
        placeholder="Write your message..."
        value={compose.body}
        onChange={(e) => dispatch(setCompose({ body: e.target.value }))}
      />

      <footer className="p-3 border-t border-border flex flex-col sm:flex-row gap-2 sm:gap-0 sm:justify-between">
        <Button
          variant="outline"
          onClick={handleClose}
          disabled={sending}
          className="w-full sm:w-auto bevel"
        >
          Discard
        </Button>
        <Button
          disabled={!compose.to || !compose.subject || sending}
          onClick={handleSend}
          className="w-full sm:w-auto chrome-surface text-foreground"
        >
          {sending ? 'Sending...' : 'Send'}
        </Button>
      </footer>
    </div>
  );
}
