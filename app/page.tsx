import AppShell from '@/components/layout/AppShell';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export default async function Page() {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  return <AppShell />;
}
