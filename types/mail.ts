export interface Email {
  id: string;

  from: string;
  subject: string;
  preview: string;
  body: string;
  htmlBody?: string; // HTML version of email body

  date: string;

  unread: boolean;
  attachments?: EmailAttachment[];
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
