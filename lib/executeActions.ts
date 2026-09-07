import { store } from '@/store';
import {
  removeEmails,
  restoreEmails,
  setUnread,
  toggleStar,
} from '@/store/mailSlice';
import { setItemStatus } from '@/store/actionsSlice';
import type { ActionItem, ProposedAction } from '@/types/actions';
import type { Email } from '@/types/mail';
import type { ModifyOp } from '@/lib/gmail';

async function modify(ids: string[], op: ModifyOp): Promise<void> {
  const res = await fetch('/api/emails/modify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, op }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Failed to ${op}`);
  }
}

/** Apply the optimistic Redux update for one already-succeeded label op */
function applyLocally(action: ProposedAction, restorable: Map<string, Email>) {
  switch (action.kind) {
    case 'archive':
      store.dispatch(removeEmails([action.emailId]));
      break;
    case 'unarchive': {
      const e = restorable.get(action.emailId);
      if (e) store.dispatch(restoreEmails([e]));
      break;
    }
    case 'star':
      store.dispatch(toggleStar({ id: action.emailId, starred: action.starred }));
      break;
    case 'read':
      store.dispatch(setUnread({ id: action.emailId, unread: action.unread }));
      break;
    case 'reply':
      break;
  }
}

/** The inverse of a reversible action, or null for sends */
export function invert(
  action: ProposedAction,
  emailsById: Map<string, Email>
): ProposedAction | null {
  switch (action.kind) {
    case 'archive':
      return { kind: 'unarchive', emailId: action.emailId };
    case 'unarchive':
      return { kind: 'archive', emailId: action.emailId };
    case 'star':
      return { kind: 'star', emailId: action.emailId, starred: !action.starred };
    case 'read': {
      const e = emailsById.get(action.emailId);
      return { kind: 'read', emailId: action.emailId, unread: e ? e.unread : !action.unread };
    }
    case 'reply':
      return null;
  }
}

export interface RunResult {
  done: number;
  failed: number;
  /** Actions that succeeded and can be reverted */
  reverted: ProposedAction[];
  /** Emails removed by archive, so undo can put them back locally */
  archived: Email[];
}

/**
 * Execute a list of approved action items. Label ops are batched per op;
 * replies send one at a time. Each item's status is updated as it goes.
 */
export async function executeActions(
  items: ActionItem[],
  restorable: Email[] = []
): Promise<RunResult> {
  const state = store.getState();
  const emailsById = new Map(state.mail.emails.map((e) => [e.id, e]));
  const restorableById = new Map(restorable.map((e) => [e.id, e]));

  const result: RunResult = { done: 0, failed: 0, reverted: [], archived: [] };
  const mark = (id: string, status: 'running' | 'done' | 'failed', error?: string) =>
    store.dispatch(setItemStatus({ id, status, error }));

  // Group label ops so each kind is one Gmail call
  const groups = new Map<ModifyOp, ActionItem[]>();
  const replies: ActionItem[] = [];

  for (const item of items) {
    const a = item.action;
    let op: ModifyOp | null = null;
    if (a.kind === 'archive') op = 'archive';
    else if (a.kind === 'unarchive') op = 'unarchive';
    else if (a.kind === 'star') op = a.starred ? 'star' : 'unstar';
    else if (a.kind === 'read') op = a.unread ? 'unread' : 'read';
    if (op) groups.set(op, [...(groups.get(op) ?? []), item]);
    else replies.push(item);
  }

  for (const [op, group] of groups) {
    group.forEach((i) => mark(i.id, 'running'));
    try {
      await modify(group.map((i) => i.action.emailId), op);
      for (const i of group) {
        // Capture the email before the local update removes it
        if (i.action.kind === 'archive') {
          const e = emailsById.get(i.action.emailId);
          if (e) result.archived.push(e);
        }
        const inv = invert(i.action, emailsById);
        if (inv) result.reverted.push(inv);
        applyLocally(i.action, restorableById);
        mark(i.id, 'done');
        result.done++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed';
      group.forEach((i) => mark(i.id, 'failed', msg));
      result.failed += group.length;
    }
  }

  for (const item of replies) {
    if (item.action.kind !== 'reply') continue;
    mark(item.id, 'running');
    const original = emailsById.get(item.action.emailId);
    try {
      const res = await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: item.action.to,
          subject: item.action.subject,
          body: item.action.body,
          threadId: original?.threadId,
          inReplyTo: original?.messageId,
        }),
      });
      if (!res.ok) throw new Error('Send failed');
      mark(item.id, 'done');
      result.done++;
    } catch (err) {
      mark(item.id, 'failed', err instanceof Error ? err.message : 'Send failed');
      result.failed++;
    }
  }

  return result;
}

/** Revert a previous run. `archived` supplies the emails to put back locally. */
export async function revertActions(
  revert: ProposedAction[],
  archived: Email[]
): Promise<RunResult> {
  const items: ActionItem[] = revert.map((action, i) => ({
    id: `undo-${i}`,
    action,
    reason: '',
    status: 'pending',
  }));
  return executeActions(items, archived);
}
