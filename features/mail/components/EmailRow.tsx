'use client';

import { cn, formatMailDate } from '@/lib/utils';
import { openEmail } from '@/store/uiSlice';
import { markAsRead, toggleStar } from '@/store/mailSlice';
import { Email, EmailCategory } from '@/types/mail';
import { useAppDispatch, useAppSelector } from '@/store';
import { Star, Paperclip } from 'lucide-react';
import { useState } from 'react';
import AIStatusBadge from './AIStatusBadge';

interface Props {
  email: Email;
}

const CATEGORY_DOT: Record<EmailCategory, string> = {
  primary: 'bg-accent',
  promotions: 'bg-pink',
  updates: 'bg-ice',
  social: 'bg-mint',
  forums: 'bg-muted-foreground',
};

export default function EmailRow({ email }: Props) {
  const dispatch = useAppDispatch();
  const detailEmailId = useAppSelector((state) => state.ui.detailEmailId);
  const [starring, setStarring] = useState(false);
  const isSelected = detailEmailId === email.id;

  const handleOpen = () => {
    dispatch(openEmail(email.id));
    if (email.unread) {
      fetch('/api/emails/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: email.id }),
      }).catch(() => {});
      dispatch(markAsRead(email.id));
    }
  };

  const handleToggleStar = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (starring) return;
    const next = !email.starred;
    setStarring(true);
    dispatch(toggleStar({ id: email.id, starred: next }));
    try {
      const response = await fetch('/api/emails/star', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: email.id, starred: next }),
      });
      if (!response.ok) {
        dispatch(toggleStar({ id: email.id, starred: !next }));
      }
    } catch {
      dispatch(toggleStar({ id: email.id, starred: !next }));
    } finally {
      setStarring(false);
    }
  };

  return (
    <div
      onClick={handleOpen}
      className={cn(
        'group flex items-start gap-2.5 px-3 py-2 cursor-pointer border-b border-border transition-colors',
        isSelected
          ? 'bg-surface-2 border-l-2 border-l-accent -ml-px'
          : 'hover:bg-surface-2 border-l-2 border-l-transparent'
      )}
    >
      <span
        className={cn(
          'mt-1.5 h-1.5 w-1.5 rounded-full shrink-0',
          email.unread ? CATEGORY_DOT[email.category] : 'bg-transparent'
        )}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              'text-sm truncate',
              email.unread ? 'font-semibold text-foreground' : 'text-muted-foreground'
            )}
          >
            {email.fromName}
          </span>
          <span className="chrome-label text-muted-foreground shrink-0">
            {formatMailDate(email.date)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              'text-[13px] truncate',
              email.unread ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            {email.subject || '(no subject)'}
          </span>
          <span className="flex items-center gap-1 shrink-0">
            {email.attachments && email.attachments.length > 0 && (
              <Paperclip className="h-3 w-3 text-muted-foreground" />
            )}
            <button
              onClick={handleToggleStar}
              className={cn(
                'transition-opacity',
                email.starred ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              )}
              title={email.starred ? 'Unstar' : 'Star'}
            >
              <Star
                className={cn(
                  'h-3.5 w-3.5',
                  email.starred
                    ? 'fill-accent text-accent'
                    : 'text-muted-foreground'
                )}
              />
            </button>
          </span>
        </div>

        <div className="text-xs text-muted-foreground truncate mt-0.5">
          {email.preview}
        </div>

        {email.ai && <AIStatusBadge ai={email.ai} className="mt-1" />}
      </div>
    </div>
  );
}
