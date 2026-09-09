'use client';

import { useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useAppDispatch, useAppSelector } from '@/store';
import { setView } from '@/store/uiSlice';
import { Zap, Clock } from 'lucide-react';
import EmailList from './components/EmailList';
import { Skeleton } from '@/components/ui/skeleton';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function TodayView() {
  const { data: session } = useSession();
  const dispatch = useAppDispatch();
  const emails = useAppSelector((state) => state.mail.emails);
  const loading = useAppSelector((state) => state.mail.loading);
  const classifying = useAppSelector((state) => state.mail.classifying);

  const firstName = session?.user?.name?.split(' ')[0] ?? '';

  const needsReply = useMemo(
    () => emails.filter((e) => e.ai?.status === 'needs_reply'),
    [emails]
  );
  const waitingOn = useMemo(
    () => emails.filter((e) => e.ai?.status === 'waiting_on'),
    [emails]
  );
  const recent = useMemo(() => emails.slice(0, 5), [emails]);

  const attentionCount = needsReply.length + waitingOn.length;
  // Only wait while a classification request is actually in flight. It used to
  // key off "no email has a status yet", which never cleared when the model
  // returned nothing.
  const showSkeleton = classifying && !emails.some((e) => e.ai);

  return (
    <div className="w-full h-full overflow-y-auto no-scrollbar p-4 sm:p-6">
      <h1 className="text-xl font-semibold">
        {getGreeting()}{firstName ? `, ${firstName}` : ''}.
      </h1>
      <p className="text-sm text-muted-foreground mt-1 mb-5">
        {loading || classifying
          ? 'Reading your inbox…'
          : attentionCount > 0
            ? `${attentionCount} email${attentionCount !== 1 ? 's' : ''} need${attentionCount === 1 ? 's' : ''} your attention.`
            : 'You’re all caught up.'}
      </p>

      {showSkeleton && !loading && (
        <div className="space-y-2 mb-6">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      )}

      {needsReply.length > 0 && (
        <div className="bevel rounded-lg bg-card mb-4 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-pink/15">
            <span className="chrome-label flex items-center gap-1.5 text-foreground">
              <Zap className="h-3.5 w-3.5" /> Needs Reply
            </span>
            <span className="chrome-label text-muted-foreground">
              {needsReply.length}
            </span>
          </div>
          <EmailList emails={needsReply.slice(0, 3)} />
          <button
            onClick={() => dispatch(setView('NEEDS_REPLY'))}
            className="w-full text-center py-2 text-xs font-medium text-accent hover:bg-surface-2 transition-colors"
          >
            Review replies
          </button>
        </div>
      )}

      {waitingOn.length > 0 && (
        <div className="bevel rounded-lg bg-card mb-4 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-ice/15">
            <span className="chrome-label flex items-center gap-1.5 text-foreground">
              <Clock className="h-3.5 w-3.5" /> Waiting On
            </span>
            <span className="chrome-label text-muted-foreground">
              {waitingOn.length}
            </span>
          </div>
          <EmailList emails={waitingOn.slice(0, 3)} />
          <button
            onClick={() => dispatch(setView('WAITING_ON'))}
            className="w-full text-center py-2 text-xs font-medium text-accent hover:bg-surface-2 transition-colors"
          >
            Review follow-ups
          </button>
        </div>
      )}

      {recent.length > 0 && (
        <div>
          <p className="chrome-label text-muted-foreground mb-2">Recent</p>
          <div className="bevel rounded-lg bg-card overflow-hidden">
            <EmailList emails={recent} />
          </div>
        </div>
      )}

      {!loading && emails.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No emails found
        </div>
      )}
    </div>
  );
}
