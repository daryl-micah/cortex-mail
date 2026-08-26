'use client';

import { Button } from '@/components/ui/button';
import { RootState } from '@/store';
import { closeEmail, openCompose } from '@/store/uiSlice';
import { setCompose } from '@/store/mailSlice';
import { useAppDispatch, useAppSelector } from '@/store';
import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Reply, ReplyAll, Forward } from 'lucide-react';
import { formatMailDate } from '@/lib/utils';
import DOMPurify from 'isomorphic-dompurify';

const RESIZE_SCRIPT = `
<script>
  function reportHeight() {
    var h = document.body.scrollHeight;
    parent.postMessage({ __cortexResize: true, height: h }, '*');
  }
  window.addEventListener('load', reportHeight);
  new ResizeObserver(reportHeight).observe(document.body);
</script>
`;

export default function EmailDetailView() {
  const dispatch = useAppDispatch();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(300);

  const { detailEmailId } = useAppSelector((state: RootState) => state.ui);
  const email = useAppSelector((state: RootState) => {
    const inboxEmail = state.mail.emails.find((e) => e.id === detailEmailId);
    const sentEmail = state.mail.sentEmails.find(
      (e) => e.id === detailEmailId
    );
    return inboxEmail || sentEmail;
  });

  const sanitizedSrcDoc = useMemo(() => {
    if (!email?.htmlBody) return undefined;

    let html = email.htmlBody;
    if (email.attachments) {
      email.attachments.forEach((attachment) => {
        if (attachment.contentId && attachment.isInline) {
          const cidPattern = new RegExp(`cid:${attachment.contentId}`, 'gi');
          const attachmentUrl = `/api/emails/attachment?messageId=${email.id}&attachmentId=${attachment.attachmentId}&mimeType=${encodeURIComponent(attachment.mimeType)}`;
          html = html.replace(cidPattern, attachmentUrl);
        }
      });
    }

    const clean = DOMPurify.sanitize(html, {
      WHOLE_DOCUMENT: false,
      FORBID_TAGS: ['script', 'style'],
    });

    return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>body{margin:0;padding:0;font-family:Inter,ui-sans-serif,sans-serif;color:#1B1826;}</style></head><body>${clean}</body>${RESIZE_SCRIPT}</html>`;
  }, [email]);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (
        iframeRef.current &&
        e.source === iframeRef.current.contentWindow &&
        e.data?.__cortexResize
      ) {
        setIframeHeight(Math.max(200, e.data.height + 20));
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  if (!email) {
    return (
      <div className="flex flex-col h-full">
        <header className="p-3 border-b flex justify-end">
          <Button onClick={() => dispatch(closeEmail())} variant="ghost" size="icon-sm">
            <X className="h-4 w-4" />
          </Button>
        </header>
        <div className="p-4 text-muted-foreground text-sm">Email not found</div>
      </div>
    );
  }

  const handleClose = () => dispatch(closeEmail());

  const handleReply = (mode: 'reply' | 'replyAll' | 'forward') => {
    const subjectPrefix = mode === 'forward' ? 'Fwd: ' : 'Re: ';
    dispatch(
      setCompose({
        to: mode === 'forward' ? '' : email.fromEmail,
        subject: `${subjectPrefix}${email.subject}`,
        body:
          mode === 'forward'
            ? `\n\n---------- Forwarded message ----------\nFrom: ${email.from}\nSubject: ${email.subject}\n\n${email.body}`
            : `\n\n---\nOn ${formatMailDate(email.date)}, ${email.fromName} wrote:\n${email.body}`,
      })
    );
    dispatch(openCompose());
  };

  return (
    <div className="flex flex-col h-full">
      <header className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button onClick={handleReply.bind(null, 'reply')} variant="ghost" size="sm">
            <Reply className="h-4 w-4" />
          </Button>
        </div>
        <Button onClick={handleClose} variant="ghost" size="icon-sm" aria-label="Close">
          <X className="h-4 w-4" />
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar p-4 sm:p-6 space-y-4">
        <h2 className="text-lg sm:text-xl font-semibold wrap-break-word">
          {email.subject || '(no subject)'}
        </h2>

        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full chrome-surface flex items-center justify-center chrome-label text-[11px] text-foreground shrink-0">
            {email.initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{email.fromName}</div>
            <div className="text-xs text-muted-foreground truncate">
              {email.fromEmail}
            </div>
          </div>
          <div className="chrome-label text-muted-foreground shrink-0">
            {formatMailDate(email.date)}
          </div>
        </div>

        <div className="border-t border-border pt-4">
          {sanitizedSrcDoc ? (
            <iframe
              ref={iframeRef}
              srcDoc={sanitizedSrcDoc}
              sandbox="allow-popups allow-downloads allow-forms allow-scripts"
              className="w-full border-0"
              style={{ height: iframeHeight, colorScheme: 'light' }}
              title={email.subject || 'Email content'}
            />
          ) : (
            <div className="text-sm whitespace-pre-wrap">{email.body}</div>
          )}
        </div>
      </div>

      <footer className="p-3 border-t border-border flex flex-wrap gap-2">
        <Button onClick={() => handleReply('reply')} variant="outline" size="sm" className="bevel">
          <Reply className="h-3.5 w-3.5 mr-1.5" /> Reply
        </Button>
        <Button onClick={() => handleReply('replyAll')} variant="outline" size="sm" className="bevel">
          <ReplyAll className="h-3.5 w-3.5 mr-1.5" /> Reply All
        </Button>
        <Button onClick={() => handleReply('forward')} variant="outline" size="sm" className="bevel">
          <Forward className="h-3.5 w-3.5 mr-1.5" /> Forward
        </Button>
      </footer>
    </div>
  );
}
