'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useAppDispatch } from '@/store';
import { setError } from '@/store/mailSlice';
import { refreshInbox } from '@/lib/useEmailSync';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Refetch the inbox in place. Runs the same path as the 30s poll, so a manual
 * refresh reclassifies anything that came back unread by the model last time.
 */
export default function RefreshButton({ className }: { className?: string }) {
  const dispatch = useAppDispatch();
  const [spinning, setSpinning] = useState(false);

  const handleRefresh = async () => {
    if (spinning) return;
    setSpinning(true);
    try {
      // Silent: keep the current list on screen instead of blanking it.
      await refreshInbox(dispatch, { silent: true });
    } catch {
      dispatch(setError('Could not refresh your inbox.'));
    } finally {
      setSpinning(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={handleRefresh}
      disabled={spinning}
      title="Refresh"
      aria-label="Refresh inbox"
      className={className}
    >
      <RefreshCw
        className={cn('h-3.5 w-3.5', spinning && 'animate-spin')}
        aria-hidden
      />
    </Button>
  );
}
