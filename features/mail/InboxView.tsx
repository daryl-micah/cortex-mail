'use client';

import { useAppSelector, useAppDispatch } from '@/store';
import EmailList from '../mail/components/EmailList';
import { Inbox, X } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { setFilters } from '@/store/mailSlice';

export default function InboxView() {
  const emails = useAppSelector((state) => state.mail.emails);
  const filters = useAppSelector((state) => state.mail.filters);
  const loading = useAppSelector((state) => state.mail.loading);
  const error = useAppSelector((state) => state.mail.error);
  const dispatch = useAppDispatch();

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
    <div className="max-w-full max-h-screen overflow-y-auto p-4">
      <div className="flex flex-row space-x-2 items-center justify-between">
        <div className="flex items-center space-x-2">
          <Inbox className="w-6 h-6 mb-4 text-red-600" />
          <h1 className="text-2xl font-bold mb-4">Inbox</h1>
        </div>
        {Object.keys(filters).length > 0 && (
          <div className="flex flex-row items-center space-x-1">
            <Button
              className="hover:bg-red-100"
              variant="ghost"
              size="sm"
              onClick={() => {
                dispatch(setFilters({}));
              }}
            >
              <X className="cursor-pointer" />
            </Button>
            <span className="text-sm text-muted-foreground">(filtered)</span>
          </div>
        )}
      </div>

      {error && (
        <div className="text-red-600 bg-red-50 p-3 rounded mb-4">{error}</div>
      )}

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          Loading emails...
        </div>
      ) : emails.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No emails found
        </div>
      ) : (
        <EmailList emails={filteredEmails} />
      )}
    </div>
  );
}
