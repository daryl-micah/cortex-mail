'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { signIn } from 'next-auth/react';
import Image from 'next/image';

export default function LoginPage() {
  const handleGoogleSignIn = async () => {
    await signIn('google', { callbackUrl: '/' });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-blue-50 to-indigo-100">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <Image
              src="/cortex.png"
              alt="Cortex Mail Logo"
              width={150}
              height={150}
            />
          </div>
          <h1 className="text-3xl font-bold">Cortex Mail</h1>
          <p className="text-muted-foreground">
            Sign in with Google to access your emails
          </p>
        </div>

        <div className="space-y-4">
          <Button
            onClick={handleGoogleSignIn}
            className="w-full"
            size="lg"
            variant="outline"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </Button>

          <div className="text-xs text-center text-muted-foreground">
            We'll request access to read and send emails on your behalf
          </div>
        </div>

        <div className="border-t pt-6 space-y-2 text-sm text-muted-foreground">
          <h3 className="font-semibold text-foreground">Features:</h3>
          <ul className="space-y-1 ml-4 list-disc">
            <li>AI-powered email composition</li>
            <li>Smart email filtering and search</li>
            <li>Context-aware assistant</li>
            <li>Real-time email sync</li>
          </ul>
        </div>
        <div className="pt-4 text-xs text-center text-muted-foreground">
          <a
            href="/policy"
            className="underline hover:text-foreground transition-colors"
          >
            Privacy Policy
          </a>
          <span className="mx-2">·</span>
          <a
            href="/terms"
            className="underline hover:text-foreground transition-colors"
          >
            Terms of Service
          </a>
        </div>
      </Card>
    </div>
  );
}
