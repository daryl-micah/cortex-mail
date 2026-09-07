'use client';

import { useAppSelector, useAppDispatch } from '@/store';
import { RootState } from '@/store';
import TodayView from '@/features/mail/TodayView';
import InboxView from '@/features/mail/InboxView';
import SentView from '@/features/mail/SentView';
import EmailDetailView from '@/features/mail/EmailDetailView';
import ComposeView from '@/features/mail/ComposeView';
import Drawer from '@/components/ui/Drawer';
import { closeEmail, closeCompose } from '@/store/uiSlice';
import { useEmailSync } from '@/lib/useEmailSync';

export default function MainView() {
  const view = useAppSelector((state: RootState) => state.ui.view);
  const detailEmailId = useAppSelector(
    (state: RootState) => state.ui.detailEmailId
  );
  const composeOpen = useAppSelector(
    (state: RootState) => state.ui.composeOpen
  );
  const dispatch = useAppDispatch();

  // Fetch emails on mount
  useEmailSync();

  const renderView = () => {
    switch (view) {
      case 'TODAY':
        return <TodayView />;
      case 'INBOX':
        return <InboxView />;
      case 'SENT':
        return <SentView />;
      case 'NEEDS_REPLY':
        return <InboxView statusFilter="needs_reply" title="Needs Reply" />;
      case 'WAITING_ON':
        return <InboxView statusFilter="waiting_on" title="Waiting On" />;
      case 'FOLLOW_UP':
        return <InboxView statusFilter="follow_up" title="Follow Up" />;
      case 'STARRED':
        return <InboxView starredOnly title="Starred" />;
      default:
        return <TodayView />;
    }
  };

  return (
    <>
      {renderView()}

      <Drawer
        open={detailEmailId !== null}
        onClose={() => dispatch(closeEmail())}
        widthClassName="max-w-[760px]"
        aria-label="Email detail"
      >
        <EmailDetailView />
      </Drawer>

      <Drawer
        open={composeOpen}
        onClose={() => dispatch(closeCompose())}
        widthClassName="max-w-[560px]"
        aria-label="Compose email"
      >
        <ComposeView />
      </Drawer>
    </>
  );
}
