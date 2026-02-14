'use client';

import { useAppDispatch } from '@/store';
import NavButton from './NavButton';
import { openCompose, setView } from '@/store/uiSlice';
import { Inbox, Pencil, Search, LogOut, Send } from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';

export default function Sidebar() {
  const dispatch = useAppDispatch();
  const { data: session } = useSession();

  return (
    <aside className="border-r p-4 space-y-2 flex flex-col h-screen">
      <div className="flex-1 space-y-2">
        <h1 className="text-lg font-semibold mb-4">MailerRoid</h1>
        <NavButton
          label="Inbox"
          icon={<Inbox className="text-red-600" />}
          onClick={() => dispatch(setView('INBOX'))}
        />
        <NavButton
          label="Sent"
          icon={<Send className="text-green-600" />}
          onClick={() => dispatch(setView('SENT'))}
        />
        <NavButton
          icon={<Pencil className="text-blue-600" />}
          label="Compose"
          onClick={() => dispatch(openCompose())}
        />
        <NavButton
          icon={<Search />}
          label="Search"
          onClick={() => dispatch(setView('SEARCH'))}
        />
      </div>

      {/* User Info Section */}
      <div className="border-t pt-4 space-y-2">
        {session?.user && (
          <div className="flex items-center gap-2 mb-2">
            {session.user.image && (
              <img
                src={session.user.image}
                alt={session.user.name || 'User'}
                className="w-8 h-8 rounded-full"
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
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
