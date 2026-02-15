'use client';

import { useAppSelector } from '@/store';
import EmailList from '../mail/components/EmailList';
import { Send } from 'lucide-react';

export default function SentView() {
  const sentEmails = useAppSelector((state) => state.mail.sentEmails);
  const loading = useAppSelector((state) => state.mail.loading);

  return (
    <div className="max-w-full max-h-screen overflow-y-auto no-scrollbar p-4">
      <div className="flex flex-row space-x-2 items-center justify-between">
        <div className="flex items-center space-x-2">
          <Send className="w-6 h-6 mb-3 text-green-600" />
          <h1 className="text-2xl font-bold mb-4">Sent</h1>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          Loading sent emails...
        </div>
      ) : sentEmails.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No sent emails yet
        </div>
      ) : (
        <EmailList emails={sentEmails} />
      )}
    </div>
  );
}
