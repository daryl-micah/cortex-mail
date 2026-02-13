export interface Email {
  id: string;

  from: string;
  subject: string;
  preview: string;
  body: string;

  date: string;

  unread: boolean;
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
