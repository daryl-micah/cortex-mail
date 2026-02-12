import { RootState } from '@/store';
import { useSelector } from 'react-redux';
import EmailList from '../mail/components/EmailList';
import { Inbox } from 'lucide-react';

export default function InboxView() {
  const emails = useSelector((state: RootState) => state.mail.emails);

  return (
    <div className="max-w-full p-4">
      <div className="flex flex-row space-x-2 items-center">
        <Inbox className="w-6 h-6 mb-3 text-blue-600" />
        <h1 className="text-2xl font-bold mb-4">Inbox</h1>
      </div>
      <EmailList emails={emails} />
    </div>
  );
}
