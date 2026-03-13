'use client';

import { cn } from '@/lib/utils';
import { openEmail } from '@/store/uiSlice';
import { markAsRead } from '@/store/mailSlice';
import { Email } from '@/types/mail';
import { useAppDispatch } from '@/store';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import { useState } from 'react';

interface Props {
  email: Email;
}

export default function EmailRow({ email }: Props) {
  const dispatch = useAppDispatch();
  const [marking, setMarking] = useState(false);

  const handleMarkAsRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (marking || !email.unread) return;

    setMarking(true);
    try {
      const response = await fetch('/api/emails/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: email.id }),
      });

      if (response.ok) {
        dispatch(markAsRead(email.id));
      }
    } catch (error) {
      console.error('Failed to mark as read:', error);
    } finally {
      setMarking(false);
    }
  };

  return (
    <div
      onClick={() => dispatch(openEmail(email.id))}
      className={cn(
        'p-2 sm:p-3 rounded-lg cursor-pointer hover:bg-muted transition',
        email.unread && 'bg-muted/50'
      )}
    >
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
        <div className="flex-1 min-w-0">
          <span className="font-medium text-sm sm:text-base block truncate">
            {email.from}
          </span>
          <div className="text-xs sm:text-sm text-muted-foreground truncate">
            {email.subject}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {email.date}
          </span>
          {email.unread && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 sm:h-7 sm:w-7 p-0 cursor-pointer shrink-0"
              onClick={handleMarkAsRead}
              disabled={marking}
              title="Mark as read"
            >
              <Check className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      <div className="text-xs sm:text-sm text-muted-foreground line-clamp-2 mt-1">
        {email.preview}
      </div>
    </div>
  );
}
