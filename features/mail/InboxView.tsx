'use client';

import { useAppSelector } from '@/store';
import EmailList from '../mail/components/EmailList';
import { Inbox } from 'lucide-react';
import { useMemo } from 'react';

export default function InboxView() {
  const emails = useAppSelector((state) => state.mail.emails);
  const filters = useAppSelector((state) => state.mail.filters);

  const filteredEmails = useMemo(() => {
    let result = [...emails];

    if (filters.unread !== undefined) {
      result = result.filter((email) => email.unread === filters.unread);
    }

    if (filters.sender) {
      result = result.filter((email) =>
        email.from.toLowerCase().includes(filters.sender!.toLowerCase())
      );
    }

    if (filters.dateRange) {
      // For now, just show all emails for date filters
      // In production, you'd parse the date properly
    }

    return result;
  }, [emails, filters]);

  return (
    <div className="max-w-full p-4">
      <div className="flex flex-row space-x-2 items-center">
        <Inbox className="w-6 h-6 mb-3 text-blue-600" />
        <h1 className="text-2xl font-bold mb-4">Inbox</h1>
        {Object.keys(filters).length > 0 && (
          <span className="text-sm text-muted-foreground mb-3">(filtered)</span>
        )}
      </div>
      <EmailList emails={filteredEmails} />
    </div>
  );
}
