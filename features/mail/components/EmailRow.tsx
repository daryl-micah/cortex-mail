'use client';

import { cn } from '@/lib/utils';
import { openEmail } from '@/store/uiSlice';
import { Email } from '@/types/mail';
import { useAppDispatch } from '@/store';

interface Props {
  email: Email;
}

export default function EmailRow({ email }: Props) {
  const dispatch = useAppDispatch();

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
        <span className="text-xs text-muted-foreground">{email.date}</span>
      </div>

      <div className="text-sm">{email.subject}</div>
      <div className="text-xs text-muted-foreground">{email.preview}</div>
    </div>
  );
}
