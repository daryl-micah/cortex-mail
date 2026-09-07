'use client';

import { useAppSelector } from '@/store';
import EmailList from '../mail/components/EmailList';
import { Send } from 'lucide-react';

export default function SentView() {
  const sentEmails = useAppSelector((state) => state.mail.sentEmails);
  const loading = useAppSelector((state) => state.mail.loading);

  return (
    <div className="w-full h-full overflow-y-auto no-scrollbar p-3 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <Send className="w-4 h-4 text-accent" />
        <h1 className="text-lg font-semibold">Sent</h1>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Loading sent emails...
        </div>
      ) : sentEmails.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No sent emails yet
        </div>
      ) : (
        <EmailList emails={sentEmails} />
      )}
    </div>
  );
}
