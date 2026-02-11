'use client';

import { useDispatch } from 'react-redux';
import NavButton from './NavButton';
import { composeEmail, setView } from '@/store/uiSlice';
import { Inbox, Pencil, Search } from 'lucide-react';

export default function Sidebar() {
  const dispatch = useDispatch();

  return (
    <aside className="bg-sand border-r p-4 space-y-2">
      <h1 className="text-lg font-semibold mb-4">MailerRoid</h1>
      <NavButton
        label="Inbox"
        icon={<Inbox />}
        onClick={() => dispatch(setView('INBOX'))}
      />
      <NavButton
        icon={<Pencil />}
        label="Compose"
        onClick={() => dispatch(composeEmail())}
      />
      <NavButton
        icon={<Search />}
        label="Search"
        onClick={() => dispatch(setView('SEARCH'))}
      />
    </aside>
  );
}
