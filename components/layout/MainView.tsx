'use client';

import { useAppSelector } from '@/store';
import { RootState } from '@/store';
import InboxView from '@/features/mail/InboxView';
import EmailDetailView from '@/features/mail/EmailDetailView';
import ComposeView from '@/features/mail/ComposeView';
import SearchView from '@/features/mail/SearchView';

export default function MainView() {
  const view = useAppSelector((state: RootState) => state.ui.view);

  switch (view) {
    case 'INBOX':
      return <InboxView />;

    case 'EMAIL_DETAIL':
      return <EmailDetailView />;

    case 'OPEN_COMPOSE':
      return <ComposeView />;

    case 'SEARCH':
      return <SearchView />;

    default:
      return <InboxView />;
  }
}
