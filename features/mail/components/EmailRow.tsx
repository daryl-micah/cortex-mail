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
        'p-3 rounded-lg cursor-pointer hover:bg-muted transition',
        email.unread && 'bg-muted/50'
      )}
    >
      <div className="flex justify-between">
        <span className="font-medium">{email.from}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{email.date}</span>
          {email.unread && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={handleMarkAsRead}
              disabled={marking}
              title="Mark as read"
            >
              <Check className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      <div className="text-sm">{email.subject}</div>
      <div className="text-xs text-muted-foreground">{email.preview}</div>
    </div>
  );
}
