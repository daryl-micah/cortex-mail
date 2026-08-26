export type EmailCategory =
  | 'primary'
  | 'promotions'
  | 'updates'
  | 'social'
  | 'forums';

export type AIStatus =
  | 'needs_reply'
  | 'waiting_on'
  | 'follow_up'
  | 'fyi'
  | 'important'
  | 'handled';

export interface EmailAI {
  status: AIStatus;
  reason: string;
  deadline?: string; // ISO
  summary?: string;
}

export interface Email {
  id: string;

  from: string;
  fromName: string;
  fromEmail: string;
  initials: string;

  subject: string;
  preview: string;
  body: string;
  htmlBody?: string; // HTML version of email body

  date: string; // ISO 8601

  unread: boolean;
  starred: boolean;
  category: EmailCategory;
  attachments?: EmailAttachment[];

  ai?: EmailAI;
}

export interface EmailAttachment {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
  isInline?: boolean;
  contentId?: string; // For inline images (CID)
}

export interface Filters {
  unread?: boolean;
  dateRange?: string;
  sender?: string;
  clear?: boolean;
}

export type ComposeState =
  | 'closed'
  | 'opening'
  | 'editing'
  | 'ai_generating'
  | 'sending'
  | 'error';
