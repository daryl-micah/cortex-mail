import AppShell from '@/components/layout/AppShell';
import LandingPage from '@/components/landing/LandingPage';
import { auth } from '@/auth';

export default async function Page() {
  const session = await auth();

  if (!session) {
    return <LandingPage />;
  }

  return <AppShell />;
}
