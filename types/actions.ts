/** One consequential action the agent wants to take. Nothing here runs until the user approves it. */
export type ProposedAction =
  | { kind: 'reply'; emailId: string; to: string; subject: string; body: string }
  | { kind: 'archive'; emailId: string }
  /** Internal only — produced by undo, never proposed by the agent */
  | { kind: 'unarchive'; emailId: string }
  | { kind: 'star'; emailId: string; starred: boolean }
  | { kind: 'read'; emailId: string; unread: boolean };

export type ActionKind = ProposedAction['kind'];

export type ActionStatus =
  | 'pending'
  | 'rejected'
  | 'running'
  | 'done'
  | 'failed';

export interface ActionItem {
  id: string;
  action: ProposedAction;
  /** One sentence from the model explaining why — shown in the review row */
  reason: string;
  status: ActionStatus;
  error?: string;
}

export interface UndoEntry {
  label: string;
  revert: ProposedAction[];
  /** Emails that were archived, so undo can restore them locally */
  archived: import('./mail').Email[];
}
