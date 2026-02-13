'use client';

import { Button } from '@/components/ui/button';
import { RootState } from '@/store';
import { markAsRead } from '@/store/mailSlice';
import { setView } from '@/store/uiSlice';
import { useAppDispatch, useAppSelector } from '@/store';

export default function EmailDetailView() {
  const dispatch = useAppDispatch();

  const { selectedEmailId } = useAppSelector((state: RootState) => state.ui);
  const email = useAppSelector((state: RootState) =>
    state.mail.emails.find((e) => e.id === selectedEmailId)
  );

  if (!email) {
    return <div className="text-muted-foreground">Email not found</div>;
  }

  const handleBack = () => {
    dispatch(setView('INBOX'));
  };

  const handleMarkAsRead = () => {
    dispatch(markAsRead(email.id));
  };

  return (
    <div className="max-w-full space-y-4">
      <div className="flex gap-2">
        <Button onClick={handleBack} variant="ghost">
          Back
        </Button>
        {email.unread && (
          <Button onClick={handleMarkAsRead} variant="ghost">
            Mark as Read
          </Button>
        )}
      </div>

      <div className="border rounded-xl p-5 space-y-3">
        <div className="text-sm text-muted-foreground ">From: {email.from}</div>

        <h2 className="text-xl font-semibold">{email.subject}</h2>

        <div className="text-sm whitespace-pre-wrap">{email.body}</div>
      </div>
    </div>
  );
}
