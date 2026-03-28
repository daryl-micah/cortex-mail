import AppShell from '@/components/layout/AppShell';
import { auth } from '@/auth';
import Image from 'next/image';
import { redirect } from 'next/navigation';

export default async function Page() {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="relative">
      <a
        href="https://github.com/daryl-micah/cortex-mail"
        target="_blank"
        rel="noreferrer"
        aria-label="View project on GitHub"
        className="absolute right-4 top-4 z-50 rounded-md border bg-background/20 p-2 text-muted-foreground transition-colors hover:text-foreground"
      >
        <Image
          src="/github.svg"
          alt="GitHub"
          width={20}
          height={20}
          className="h-5 w-5"
        />
      </a>
      <AppShell />
    </div>
  );
}
