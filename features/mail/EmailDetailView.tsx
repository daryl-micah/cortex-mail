'use client';

import { Button } from '@/components/ui/button';
import { RootState } from '@/store';
import { markAsRead } from '@/store/mailSlice';
import { setView } from '@/store/uiSlice';
import { useAppDispatch, useAppSelector } from '@/store';
import { useMemo } from 'react';

export default function EmailDetailView() {
  const dispatch = useAppDispatch();

  const { selectedEmailId } = useAppSelector((state: RootState) => state.ui);
  const email = useAppSelector((state: RootState) =>
    state.mail.emails.find((e) => e.id === selectedEmailId)
  );

  // Replace CID references with attachment URLs
  const processedHtmlBody = useMemo(() => {
    if (!email?.htmlBody || !email?.attachments) return email?.htmlBody;

    let html = email.htmlBody;

    // Replace cid: references with actual attachment URLs
    email.attachments.forEach((attachment) => {
      if (attachment.contentId && attachment.isInline) {
        const cidPattern = new RegExp(`cid:${attachment.contentId}`, 'gi');
        const attachmentUrl = `/api/emails/attachment?messageId=${email.id}&attachmentId=${attachment.attachmentId}&mimeType=${encodeURIComponent(attachment.mimeType)}`;
        html = html.replace(cidPattern, attachmentUrl);
      }
    });

    return html;
  }, [email]);

  if (!email) {
    return <div className="text-muted-foreground">Email not found</div>;
  }

  const handleBack = () => {
    dispatch(setView('INBOX'));
  };

  const handleMarkAsRead = async () => {
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
    }
  };

  return (
    <div className="max-w-full max-h-screen overflow-y-auto p-4 space-y-4">
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

        {email.htmlBody ? (
          <iframe
            srcDoc={processedHtmlBody}
            sandbox="allow-same-origin"
            className="w-full min-h-96 border-0"
            style={{
              colorScheme: 'light dark',
            }}
            onLoad={(e) => {
              const iframe = e.target as HTMLIFrameElement;
              if (iframe.contentWindow) {
                // Auto-resize iframe to content height
                const height = iframe.contentWindow.document.body.scrollHeight;
                iframe.style.height = `${height + 20}px`;
              }
            }}
          />
        ) : (
          <div className="text-sm whitespace-pre-wrap">{email.body}</div>
        )}
      </div>
    </div>
  );
}
