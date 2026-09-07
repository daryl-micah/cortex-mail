'use client';

import { useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store';
import NavButton from './NavButton';
import { openCompose, setCategoryView, setView, ViewMode } from '@/store/uiSlice';
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
  LogOut,
} from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import type { EmailCategory } from '@/types/mail';

interface SidebarProps {
  onClose?: () => void;
  onOpenSearch?: () => void;
}

const SMART_CATEGORIES: { category: EmailCategory; label: string; icon: React.ReactNode }[] = [
  { category: 'updates', label: 'Updates', icon: <Tag /> },
  { category: 'promotions', label: 'Newsletters', icon: <Megaphone /> },
  { category: 'social', label: 'Social', icon: <Users /> },
  { category: 'forums', label: 'Forums', icon: <MessagesSquare /> },
];

export default function Sidebar({ onClose, onOpenSearch }: SidebarProps) {
  const dispatch = useAppDispatch();
  const { data: session } = useSession();
  const view = useAppSelector((state) => state.ui.view);
  const activeCategory = useAppSelector((state) => state.ui.activeCategory);
  const emails = useAppSelector((state) => state.mail.emails);
  const [avatarLoaded, setAvatarLoaded] = useState(false);

  const initials =
    session?.user?.name
      ?.split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || '?';

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
    <aside className="border-r border-border flex flex-col h-screen md:h-full overflow-hidden bg-card">
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
        <h1 className="hidden md:flex items-center gap-1.5 text-sm font-semibold px-1">
          <span className="font-display text-[13px] tracking-wide">CORTEX MAIL</span>
        </h1>

        <button
          onClick={() => {
            dispatch(openCompose());
            onClose?.();
          }}
          className="chrome-surface bevel rounded-md py-1.5 px-3 flex items-center justify-center gap-2 text-sm font-medium text-foreground w-full"
        >
          <Pencil className="h-4 w-4" /> Compose
        </button>

        <button
          onClick={() => {
            onOpenSearch?.();
            onClose?.();
          }}
          className="bevel rounded-md py-1.5 px-2.5 flex items-center gap-2 text-sm text-muted-foreground w-full text-left bg-surface-2"
        >
          <Search className="h-3.5 w-3.5" />
          Search mail…
        </button>

        <div className="space-y-0.5">
          <p className="chrome-label text-muted-foreground px-2.5 mb-0.5">Core</p>
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
          <p className="chrome-label text-muted-foreground px-2.5 mb-0.5">Mail</p>
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
          <p className="chrome-label text-muted-foreground px-2.5 mb-0.5">Smart</p>
          {SMART_CATEGORIES.map(({ category, label, icon }) => (
            <NavButton
              key={category}
              label={label}
              icon={icon}
              count={counts.category[category]}
              active={view === 'CATEGORY' && activeCategory === category}
              onClick={() => {
                dispatch(setCategoryView(category));
                onClose?.();
              }}
            />
          ))}
        </div>
      </div>

      {/* User Info Section — pinned, never scrolls away */}
      <div className="shrink-0 border-t border-border px-3 pt-3 pb-3 bg-card">
        <div className="chrome-label text-muted-foreground px-1 mb-2">
          Local · {Intl.DateTimeFormat().resolvedOptions().timeZone}
        </div>
        {session?.user && (
          <div className="flex items-center gap-2">
            <div className="relative w-8 h-8 rounded-full bevel shrink-0 overflow-hidden">
              {/* Always-visible base layer — never leaves the row empty */}
              <div className="absolute inset-0 chrome-surface flex items-center justify-center chrome-label text-[10px] text-foreground">
                {initials}
              </div>
              {/* Real photo — only shown once it has actually finished loading */}
              {session.user.image && (
                <Image
                  key={session.user.image}
                  src={session.user.image}
                  alt=""
                  width={32}
                  height={32}
                  unoptimized
                  referrerPolicy="no-referrer"
                  onLoad={() => setAvatarLoaded(true)}
                  className={cn(
                    'absolute inset-0 w-8 h-8 object-cover transition-opacity',
                    avatarLoaded ? 'opacity-100' : 'opacity-0'
                  )}
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {session.user.name}
              </p>
              <p className="text-xs text-muted-foreground truncate font-email">
                {session.user.email}
              </p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              title="Sign out"
              aria-label="Sign out"
              className="shrink-0 h-8 w-8 rounded-md flex items-center justify-center bevel text-muted-foreground hover:text-destructive hover:bg-surface-2 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
