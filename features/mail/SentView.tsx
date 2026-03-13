'use client';

import { useAppSelector } from '@/store';
import EmailList from '../mail/components/EmailList';
import { Send } from 'lucide-react';

export default function SentView() {
  const sentEmails = useAppSelector((state) => state.mail.sentEmails);
  const loading = useAppSelector((state) => state.mail.loading);

  return (
    <div className="w-full h-full overflow-y-auto no-scrollbar p-2 sm:p-4">
      <div className="flex flex-col sm:flex-row sm:space-x-2 sm:items-center sm:justify-between gap-2 sm:gap-0">
        <div className="flex items-center space-x-2">
          <Send className="w-5 h-5 sm:w-6 sm:h-6 mb-2 sm:mb-3 text-green-600" />
          <h1 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-4">Sent</h1>
        </div>
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
