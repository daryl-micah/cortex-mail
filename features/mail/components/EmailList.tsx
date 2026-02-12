import { Email } from '@/types/mail';
import EmailRow from './EmailRow';

export default function EmailList({ emails }: { emails: Email[] }) {
  return (
    <div className="space-y-1">
      {emails.map((email) => (
        <EmailRow key={email.id} email={email} />
      ))}
    </div>
  );
}
