'use client';

import { useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  closeReview,
  markRan,
  popUndo,
  pushUndo,
  rejectAll,
  restoreAll,
  setItemStatus,
  updateReplyBody,
} from '@/store/actionsSlice';
import { executeActions, revertActions } from '@/lib/executeActions';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ActionItem, ProposedAction } from '@/types/actions';
import {
  X,
  Reply,
  Archive,
  Star,
  MailOpen,
  Mail,
  Check,
  AlertTriangle,
  Loader2,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

const KIND_META: Record<
  ProposedAction['kind'],
  { icon: React.ComponentType<{ className?: string }>; verb: (a: ProposedAction) => string }
> = {
  reply: { icon: Reply, verb: () => 'Reply to' },
  archive: { icon: Archive, verb: () => 'Archive' },
  unarchive: { icon: Archive, verb: () => 'Move to inbox' },
  star: { icon: Star, verb: (a) => (a.kind === 'star' && !a.starred ? 'Unstar' : 'Star') },
  read: { icon: MailOpen, verb: (a) => (a.kind === 'read' && a.unread ? 'Mark unread' : 'Mark read') },
};

export default function ActionReview() {
  const dispatch = useAppDispatch();
  const { summary, items, ran, undoStack } = useAppSelector((s) => s.actions);
  const emails = useAppSelector((s) => s.mail.emails);
  const [running, setRunning] = useState(false);
  const [undoing, setUndoing] = useState(false);

  const emailsById = useMemo(() => new Map(emails.map((e) => [e.id, e])), [emails]);

  const pending = items.filter((i) => i.status === 'pending');
  const rejected = items.filter((i) => i.status === 'rejected');
  const done = items.filter((i) => i.status === 'done');
  const failed = items.filter((i) => i.status === 'failed');
  const sendCount = pending.filter((i) => i.action.kind === 'reply').length;
  const latestUndo = undoStack[0];

  const run = async () => {
    if (pending.length === 0 || running) return;
    setRunning(true);
    dispatch(markRan());
    const result = await executeActions(pending);
    if (result.reverted.length > 0) {
      const labelParts: string[] = [];
      const count = (k: string) => result.reverted.filter((a) => a.kind === k).length;
      if (count('unarchive')) labelParts.push(`archived ${count('unarchive')}`);
      if (count('star')) labelParts.push(`starred ${count('star')}`);
      if (count('read')) labelParts.push(`marked ${count('read')}`);
      dispatch(
        pushUndo({
          label: labelParts.join(', ') || `${result.reverted.length} changes`,
          revert: result.reverted,
          archived: result.archived,
        })
      );
    }
    setRunning(false);
  };

  const undo = async () => {
    if (!latestUndo || undoing) return;
    setUndoing(true);
    try {
      await revertActions(latestUndo.revert, latestUndo.archived);
      dispatch(popUndo());
    } finally {
      setUndoing(false);
    }
  };

  const close = () => dispatch(closeReview());

  return (
    <div className="flex flex-col h-full">
      <header className="p-3 border-b border-border flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            {ran ? 'Results' : `Review ${items.length} action${items.length === 1 ? '' : 's'}`}
          </div>
          {summary && <p className="text-xs text-muted-foreground font-email truncate mt-0.5">{summary}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!ran && (
            <>
              <Button variant="ghost" size="sm" onClick={() => dispatch(restoreAll())} disabled={rejected.length === 0}>
                Restore all
              </Button>
              <Button variant="ghost" size="sm" onClick={() => dispatch(rejectAll())} disabled={pending.length === 0}>
                Reject all
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon-sm" onClick={close} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {items.map((item) => (
          <ReviewRow
            key={item.id}
            item={item}
            target={emailsById.get(item.action.emailId)}
            locked={ran}
            onReject={() => dispatch(setItemStatus({ id: item.id, status: 'rejected' }))}
            onRestore={() => dispatch(setItemStatus({ id: item.id, status: 'pending' }))}
            onBodyChange={(body) => dispatch(updateReplyBody({ id: item.id, body }))}
          />
        ))}
      </div>

      <footer className="p-3 border-t border-border flex flex-wrap items-center justify-between gap-2">
        {ran ? (
          <>
            <span className="text-xs text-muted-foreground font-email">
              {running ? 'Running…' : `${done.length} done${failed.length ? ` · ${failed.length} failed` : ''}`}
            </span>
            <div className="flex items-center gap-2">
              {latestUndo && !running && (
                <Button variant="outline" size="sm" className="bevel" onClick={undo} disabled={undoing}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  {undoing ? 'Undoing…' : `Undo ${latestUndo.label}`}
                </Button>
              )}
              <Button size="sm" className="chrome-surface text-foreground" onClick={close} disabled={running}>
                Done
              </Button>
            </div>
          </>
        ) : (
          <>
            <span className="text-xs text-muted-foreground font-email">
              {sendCount > 0
                ? `${sendCount} repl${sendCount === 1 ? 'y' : 'ies'} will be sent. Sends can't be undone.`
                : 'Label changes can be undone afterwards.'}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="bevel" onClick={close}>
                Cancel
              </Button>
              <Button size="sm" className="chrome-surface text-foreground" onClick={run} disabled={pending.length === 0}>
                Run {pending.length} approved
              </Button>
            </div>
          </>
        )}
      </footer>
    </div>
  );
}

function ReviewRow({
  item,
  target,
  locked,
  onReject,
  onRestore,
  onBodyChange,
}: {
  item: ActionItem;
  target?: { fromName: string; subject: string };
  locked: boolean;
  onReject: () => void;
  onRestore: () => void;
  onBodyChange: (body: string) => void;
}) {
  const meta = KIND_META[item.action.kind];
  const Icon = meta.icon;
  const isRejected = item.status === 'rejected';
  const title = `${meta.verb(item.action)} · ${target?.fromName ?? 'Unknown'} · ${target?.subject || '(no subject)'}`;

  return (
    <div
      className={cn(
        'px-4 py-3 border-b border-border',
        isRejected && 'opacity-50',
        item.status === 'failed' && 'bg-destructive/5'
      )}
    >
      <div className="flex items-start gap-2.5">
        <StatusIcon status={item.status} fallback={Icon} />
        <div className="flex-1 min-w-0">
          <div className={cn('text-sm font-email truncate', isRejected && 'line-through')}>{title}</div>
          {!isRejected && (
            <p className="text-xs text-muted-foreground font-email mt-0.5">{item.reason}</p>
          )}
          {item.error && (
            <p className="text-xs text-destructive font-email mt-0.5">{item.error}</p>
          )}
          {item.action.kind === 'reply' && !isRejected && (
            <div className="mt-2 space-y-1">
              <div className="text-xs text-muted-foreground font-email">
                To <span className="text-foreground">{item.action.to}</span> · {item.action.subject}
              </div>
              <textarea
                value={item.action.body}
                onChange={(e) => onBodyChange(e.target.value)}
                disabled={locked}
                rows={4}
                className="w-full text-sm font-email bevel rounded-md bg-card p-2.5 resize-y focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-70"
              />
            </div>
          )}
        </div>
        {!locked && (
          <button
            onClick={isRejected ? onRestore : onReject}
            className="shrink-0 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            {isRejected ? 'Restore' : 'Reject'}
          </button>
        )}
      </div>
    </div>
  );
}

function StatusIcon({
  status,
  fallback: Fallback,
}: {
  status: ActionItem['status'];
  fallback: React.ComponentType<{ className?: string }>;
}) {
  const cls = 'h-4 w-4 mt-0.5 shrink-0';
  switch (status) {
    case 'running':
      return <Loader2 className={cn(cls, 'animate-spin text-accent')} />;
    case 'done':
      return <Check className={cn(cls, 'text-mint')} />;
    case 'failed':
      return <AlertTriangle className={cn(cls, 'text-destructive')} />;
    case 'rejected':
      return <Mail className={cn(cls, 'text-muted-foreground')} />;
    default:
      return <Fallback className={cn(cls, 'text-muted-foreground')} />;
  }
}
