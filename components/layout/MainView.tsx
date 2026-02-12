'use client';

import { useSelector } from 'react-redux';
import { RootState } from '@/store';
import InboxView from '@/features/InboxView';
import EmailDetailView from '@/features/EmailDetailView';
import ComposeView from '@/features/ComposeView';
import SearchView from '@/features/SearchView';

export default function MainView() {
  const view = useSelector((state: RootState) => state.ui.view);

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
