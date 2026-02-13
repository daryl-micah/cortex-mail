'use client';

import { useAppDispatch } from '@/store';
import NavButton from './NavButton';
import { openCompose, setView } from '@/store/uiSlice';
import { Inbox, Pencil, Search } from 'lucide-react';

export default function Sidebar() {
  const dispatch = useAppDispatch();

  return (
    <aside className="border-r p-4 space-y-2">
      <h1 className="text-lg font-semibold mb-4">MailerRoid</h1>
      <NavButton
        label="Inbox"
        icon={<Inbox className="text-red-600" />}
        onClick={() => dispatch(setView('INBOX'))}
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
    </aside>
  );
}
