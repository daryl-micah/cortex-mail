export type AssistantAction =
  | { type: 'OPEN_COMPOSE' }
  | {
      type: 'FILL_COMPOSE';
      payload: {
        to?: string;
        subject?: string;
        body?: string;
      };
    }
  | { type: 'SEND_EMAIL' }
  | {
      type: 'FILTER_EMAILS';
      payload: {
        unread?: boolean;
        dateRange?: string;
        sender?: string;
      };
    }
  | {
      type: 'OPEN_EMAIL';
      payload: {
        id: string;
      };
    }
  | { type: 'REPLY_TO_CURRENT' };
