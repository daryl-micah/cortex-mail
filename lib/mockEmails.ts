import { Email } from '@/types/mail';

export const MOCK_EMAILS: Email[] = [
  {
    id: crypto.randomUUID(),
    from: 'John Doe',
    subject: 'Meeting Tomorrow',
    preview: 'Hey, just checking about tomorrow...',
    body: 'Full email body goes here...',
    date: '2h ago',
    unread: true,
  },
  {
    id: crypto.randomUUID(),
    from: 'Stripe',
    subject: 'Payment Processed',
    preview: 'Your recent transaction was successful',
    body: 'Receipt details...',
    date: '5h ago',
    unread: false,
  },
  {
    id: crypto.randomUUID(),
    from: 'GitHub',
    subject: 'New Pull Request',
    preview: 'A new PR has been opened',
    body: 'PR details...',
    date: '1d ago',
    unread: true,
  },
];
