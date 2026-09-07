'use client';

import { Button } from '@/components/ui/button';
import { RootState } from '@/store';
import { closeEmail, openCompose } from '@/store/uiSlice';
import { setCompose, setInsight, removeEmails, setUnread } from '@/store/mailSlice';
import { useAppDispatch, useAppSelector } from '@/store';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Reply,
  ReplyAll,
  Forward,
  Sparkles,
  ArrowRight,
  Archive,
  MailOpen,
  FileText,
  PenLine,
  Link2,
  RotateCcw,
} from 'lucide-react';
import { formatMailDate } from '@/lib/utils';
import { htmlToText } from '@/lib/emailNormalize';
import { useAskCortex } from '@/lib/useAskCortex';
import { Skeleton } from '@/components/ui/skeleton';
import ConfirmSendDialog from '@/components/ui/ConfirmSendDialog';
import AIStatusBadge from './components/AIStatusBadge';
import DOMPurify from 'isomorphic-dompurify';

const CONTEXT_ACTIONS: { label: string; prompt: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { label: 'Summarize', prompt: 'Summarize this email in a few sentences.', icon: FileText },
  { label: 'Draft reply', prompt: 'Draft a reply to this email.', icon: PenLine },
  { label: 'Find related', prompt: 'Find emails related to this one.', icon: Link2 },
  { label: 'Draft follow-up', prompt: 'Draft a short, polite follow-up check-in for this email.', icon: RotateCcw },
];

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
  const [insightLoading, setInsightLoading] = useState(false);
  const [askInput, setAskInput] = useState('');
  const {
    ask,
    asking,
    answer,
    error: askError,
    showConfirmDialog,
    confirmSend,
    cancelSend,
    reset: resetAsk,
    compose,
  } = useAskCortex();

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

  // Plain-text body for the insight model — fall back to stripped HTML
  const plainBody = useMemo(() => {
    if (!email) return '';
    if (email.body?.trim()) return email.body;
    return email.htmlBody ? htmlToText(email.htmlBody) : '';
  }, [email]);

  // Fetch a Cortex Insight once per opened email; silent on failure
  const emailId = email?.id;
  const hasInsight = !!email?.insight;
  useEffect(() => {
    if (!emailId || hasInsight || !plainBody) return;
    let cancelled = false;
    setInsightLoading(true);
    fetch('/api/emails/insight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailId,
        subject: email?.subject ?? '',
        fromName: email?.fromName ?? '',
        body: plainBody,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data?.insight) {
          dispatch(setInsight({ id: emailId, insight: data.insight }));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setInsightLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailId, hasInsight, plainBody, dispatch]);

  // Clear any previous ask state when switching emails
  useEffect(() => {
    resetAsk();
    setAskInput('');
  }, [emailId, resetAsk]);

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

  const modify = async (op: 'archive' | 'unread') => {
    const res = await fetch('/api/emails/modify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [email.id], op }),
    }).catch(() => null);
    if (!res?.ok) return;
    if (op === 'archive') {
      dispatch(removeEmails([email.id]));
      dispatch(closeEmail());
    } else {
      dispatch(setUnread({ id: email.id, unread: true }));
      dispatch(closeEmail());
    }
  };

  const useSuggestedReply = () => {
    if (!email.insight?.suggestedReply) return;
    dispatch(
      setCompose({
        to: email.fromEmail,
        subject: `Re: ${email.subject}`,
        body: email.insight.suggestedReply,
      })
    );
    dispatch(openCompose());
  };

  const submitAsk = () => {
    const q = askInput.trim();
    if (!q) return;
    ask(q);
  };

  const insight = email.insight;
  const deadlineLabel = insight?.deadline
    ? new Date(insight.deadline).toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <div className="flex flex-col h-full">
      <header className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button onClick={handleReply.bind(null, 'reply')} variant="ghost" size="sm" title="Reply">
            <Reply className="h-4 w-4" />
          </Button>
          <Button onClick={() => modify('archive')} variant="ghost" size="sm" title="Archive">
            <Archive className="h-4 w-4" />
          </Button>
          <Button onClick={() => modify('unread')} variant="ghost" size="sm" title="Mark unread">
            <MailOpen className="h-4 w-4" />
          </Button>
        </div>
        <Button onClick={handleClose} variant="ghost" size="icon-sm" aria-label="Close">
          <X className="h-4 w-4" />
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar p-4 sm:p-6 space-y-4">
        <h2 className="text-lg sm:text-xl font-semibold wrap-break-word font-email">
          {email.subject || '(no subject)'}
        </h2>

        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full chrome-surface flex items-center justify-center chrome-label text-[11px] text-foreground shrink-0">
            {email.initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate font-email">{email.fromName}</div>
            <div className="text-xs text-muted-foreground truncate font-email">
              {email.fromEmail}
            </div>
          </div>
          <div className="chrome-label text-muted-foreground shrink-0">
            {formatMailDate(email.date)}
          </div>
        </div>

        {email.ai && (
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <AIStatusBadge ai={email.ai} />
            <span className="font-email pt-0.5">{email.ai.summary || email.ai.reason}</span>
          </div>
        )}

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
            <div className="text-sm whitespace-pre-wrap font-email">{email.body}</div>
          )}
        </div>

        {/* ✦ Cortex Insight */}
        {(insight || insightLoading) && (
          <section className="border-t border-border pt-4">
            <p className="chrome-label text-accent flex items-center gap-1.5 mb-2">
              <Sparkles className="h-3 w-3" /> Cortex Insight
            </p>
            {insightLoading && !insight ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-4/5 rounded" />
                <Skeleton className="h-4 w-3/5 rounded" />
              </div>
            ) : insight ? (
              <div className="bevel rounded-lg bg-surface-2 p-3 space-y-2">
                <p className="text-sm font-email">{insight.summary}</p>
                {(insight.action || deadlineLabel) && (
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs font-email">
                    {insight.action && (
                      <>
                        <dt className="chrome-label text-muted-foreground">Action</dt>
                        <dd>{insight.action}</dd>
                      </>
                    )}
                    {deadlineLabel && (
                      <>
                        <dt className="chrome-label text-muted-foreground">Deadline</dt>
                        <dd>{deadlineLabel}</dd>
                      </>
                    )}
                  </dl>
                )}
                {insight.suggestedReply && (
                  <div className="pt-1">
                    <p className="chrome-label text-muted-foreground mb-1.5">Suggested reply</p>
                    <blockquote className="text-sm font-email whitespace-pre-wrap bg-card bevel rounded-md p-2.5 text-foreground/90">
                      {insight.suggestedReply}
                    </blockquote>
                    <button
                      onClick={useSuggestedReply}
                      className="mt-2 inline-flex items-center gap-1.5 chrome-surface bevel rounded-md px-2.5 py-1.5 text-xs font-medium text-foreground"
                    >
                      Use this reply <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </section>
        )}

        {/* Contextual actions + ask */}
        <section className="border-t border-border pt-4 space-y-2.5">
          <div className="flex flex-wrap gap-1.5">
            {CONTEXT_ACTIONS.map(({ label, prompt, icon: Icon }) => (
              <button
                key={label}
                onClick={() => {
                  setAskInput('');
                  ask(prompt);
                }}
                disabled={asking}
                className="inline-flex items-center gap-1.5 bevel rounded-md bg-card px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors disabled:opacity-40"
              >
                <Icon className="h-3 w-3" /> {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 bevel rounded-md bg-card px-3 py-2">
            <Sparkles className="h-3.5 w-3.5 text-accent shrink-0" />
            <input
              value={askInput}
              onChange={(e) => setAskInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitAsk();
              }}
              placeholder="Ask Cortex about this email…"
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
            />
            <button
              onClick={submitAsk}
              disabled={!askInput.trim() || asking}
              className="text-muted-foreground hover:text-foreground disabled:opacity-40"
              aria-label="Ask"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {asking && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
              <Sparkles className="h-3.5 w-3.5 text-accent animate-pulse" />
              <span className="animate-pulse">Thinking…</span>
            </div>
          )}
          {!asking && askError && (
            <p className="text-sm text-destructive px-1">{askError}</p>
          )}
          {!asking && answer && (
            <div className="text-sm whitespace-pre-wrap font-email bevel rounded-md bg-surface-2 p-3">
              {answer}
            </div>
          )}
        </section>
      </div>

      {showConfirmDialog && (
        <ConfirmSendDialog
          to={compose.to}
          subject={compose.subject}
          body={compose.body}
          onConfirm={confirmSend}
          onCancel={cancelSend}
        />
      )}

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
