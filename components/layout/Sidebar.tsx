'use client';

import { useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '@/store';
import NavButton from './NavButton';
import { openCompose, setView, ViewMode } from '@/store/uiSlice';
import {
  Sparkles,
  Inbox,
  Zap,
  Clock,
  RotateCcw,
  Send,
  Star,
  Tag,
  Megaphone,
  Users,
  MessagesSquare,
  Pencil,
  Search,
} from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import type { EmailCategory } from '@/types/mail';

interface SidebarProps {
  onClose?: () => void;
  onOpenAssistant?: () => void;
}

const SMART_CATEGORIES: { category: EmailCategory; label: string; icon: React.ReactNode }[] = [
  { category: 'updates', label: 'Updates', icon: <Tag /> },
  { category: 'promotions', label: 'Newsletters', icon: <Megaphone /> },
  { category: 'social', label: 'Social', icon: <Users /> },
  { category: 'forums', label: 'Forums', icon: <MessagesSquare /> },
];

export default function Sidebar({ onClose, onOpenAssistant }: SidebarProps) {
  const dispatch = useAppDispatch();
  const { data: session } = useSession();
  const view = useAppSelector((state) => state.ui.view);
  const emails = useAppSelector((state) => state.mail.emails);

  const counts = useMemo(() => {
    const c = {
      inbox: emails.length,
      unread: 0,
      needsReply: 0,
      waitingOn: 0,
      followUp: 0,
      starred: 0,
      category: {} as Record<EmailCategory, number>,
    };
    for (const e of emails) {
      if (e.unread) c.unread++;
      if (e.ai?.status === 'needs_reply') c.needsReply++;
      if (e.ai?.status === 'waiting_on') c.waitingOn++;
      if (e.ai?.status === 'follow_up') c.followUp++;
      if (e.starred) c.starred++;
      c.category[e.category] = (c.category[e.category] || 0) + 1;
    }
    return c;
  }, [emails]);

  const handleNavigation = (target: ViewMode) => {
    dispatch(setView(target));
    onClose?.();
  };

  return (
    <aside className="border-r border-border p-3 space-y-4 flex flex-col h-screen md:h-full max-h-[calc(100vh-56px)] md:max-h-none overflow-y-auto bg-card">
      <h1 className="hidden md:flex items-center gap-1.5 text-sm font-semibold px-1">
        <span className="font-display text-[13px] tracking-wide">CORTEX MAIL</span>
      </h1>

      <button
        onClick={() => {
          dispatch(openCompose());
          onClose?.();
        }}
        className="chrome-surface bevel rounded-md py-2 px-3 flex items-center justify-center gap-2 text-sm font-medium text-foreground w-full"
      >
        <Pencil className="h-4 w-4" /> Compose
      </button>

      <button
        onClick={() => handleNavigation('SEARCH')}
        className="bevel rounded-md py-1.5 px-2.5 flex items-center gap-2 text-sm text-muted-foreground w-full text-left bg-surface-2"
      >
        <Search className="h-3.5 w-3.5" />
        Search mail…
      </button>

      <div className="flex-1 space-y-4">
        <div className="space-y-0.5">
          <p className="chrome-label text-muted-foreground px-2.5 mb-1">Core</p>
          <NavButton
            label="Today"
            icon={<Sparkles />}
            active={view === 'TODAY'}
            onClick={() => handleNavigation('TODAY')}
          />
          <NavButton
            label="Inbox"
            icon={<Inbox />}
            count={counts.inbox}
            active={view === 'INBOX'}
            onClick={() => handleNavigation('INBOX')}
          />
          <NavButton
            label="Needs Reply"
            icon={<Zap />}
            count={counts.needsReply}
            active={view === 'NEEDS_REPLY'}
            onClick={() => handleNavigation('NEEDS_REPLY')}
          />
          <NavButton
            label="Waiting On"
            icon={<Clock />}
            count={counts.waitingOn}
            active={view === 'WAITING_ON'}
            onClick={() => handleNavigation('WAITING_ON')}
          />
          <NavButton
            label="Follow Up"
            icon={<RotateCcw />}
            count={counts.followUp}
            active={view === 'FOLLOW_UP'}
            onClick={() => handleNavigation('FOLLOW_UP')}
          />
        </div>

        <div className="space-y-0.5">
          <p className="chrome-label text-muted-foreground px-2.5 mb-1">Mail</p>
          <NavButton
            label="Sent"
            icon={<Send />}
            active={view === 'SENT'}
            onClick={() => handleNavigation('SENT')}
          />
          <NavButton
            label="Starred"
            icon={<Star />}
            count={counts.starred}
            active={view === 'STARRED'}
            onClick={() => handleNavigation('STARRED')}
          />
        </div>

        <div className="space-y-0.5">
          <p className="chrome-label text-muted-foreground px-2.5 mb-1">Smart</p>
          {SMART_CATEGORIES.map(({ category, label, icon }) => (
            <NavButton
              key={category}
              label={label}
              icon={icon}
              count={counts.category[category]}
              onClick={() => handleNavigation('INBOX')}
            />
          ))}
        </div>

        {onOpenAssistant && (
          <div className="hidden md:block">
            <NavButton
              label="Ask Cortex"
              icon={<Sparkles />}
              onClick={onOpenAssistant}
            />
          </div>
        )}
      </div>

      {/* User Info Section */}
      <div className="border-t border-border pt-3 space-y-2">
        {session?.user && (
          <div className="flex items-center gap-2 mb-2">
            {session.user.image && (
              <img
                src={session.user.image}
                alt={session.user.name || 'User'}
                className="w-8 h-8 rounded-full bevel"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {session.user.name}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {session.user.email}
              </p>
            </div>
          </div>
        )}
        <div className="chrome-label text-muted-foreground px-1">
          Local · {Intl.DateTimeFormat().resolvedOptions().timeZone}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full bevel"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
