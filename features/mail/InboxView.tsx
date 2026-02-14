'use client';

import { useAppSelector, useAppDispatch } from '@/store';
import EmailList from '../mail/components/EmailList';
import { Inbox, X } from 'lucide-react';
import { useMemo, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  setFilters,
  appendEmails,
  setLoadingMore,
  setError,
} from '@/store/mailSlice';

export default function InboxView() {
  const emails = useAppSelector((state) => state.mail.emails);
  const filters = useAppSelector((state) => state.mail.filters);
  const loading = useAppSelector((state) => state.mail.loading);
  const loadingMore = useAppSelector((state) => state.mail.loadingMore);
  const nextPageToken = useAppSelector((state) => state.mail.nextPageToken);
  const hasMore = useAppSelector((state) => state.mail.hasMore);
  const error = useAppSelector((state) => state.mail.error);
  const dispatch = useAppDispatch();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const loadMoreEmails = useCallback(async () => {
    if (!hasMore || loadingRef.current || !nextPageToken) return;

    loadingRef.current = true;
    dispatch(setLoadingMore(true));

    try {
      const response = await fetch(
        `/api/emails/inbox?pageToken=${nextPageToken}&maxResults=20`
      );
      const data = await response.json();

      if (response.ok) {
        dispatch(
          appendEmails({
            emails: data.emails,
            nextPageToken: data.nextPageToken,
          })
        );
      } else {
        dispatch(setError(data.error || 'Failed to load more emails'));
      }
    } catch (err) {
      dispatch(setError('Failed to load more emails'));
    } finally {
      loadingRef.current = false;
    }
  }, [dispatch, hasMore, nextPageToken]);

  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || loadingRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } =
      scrollContainerRef.current;
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

    // Load more when scrolled to 80% of the content
    if (scrollPercentage > 0.8 && hasMore) {
      loadMoreEmails();
    }
  }, [hasMore, loadMoreEmails]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const filteredEmails = useMemo(() => {
    let result = [...emails];

    if (filters.unread !== undefined) {
      result = result.filter((email) => email.unread === filters.unread);
    }

    if (filters.sender) {
      result = result.filter((email) =>
        email.from.toLowerCase().includes(filters.sender!.toLowerCase())
      );
    }

    if (filters.dateRange) {
      // For now, just show all emails for date filters
      // In production, you'd parse the date properly
    }

    return result;
  }, [emails, filters]);

  return (
    <div
      ref={scrollContainerRef}
      className="max-w-full max-h-screen overflow-y-auto p-4"
    >
      <div className="flex flex-row space-x-2 items-center justify-between">
        <div className="flex items-center space-x-2">
          <Inbox className="w-6 h-6 mb-4 text-red-600" />
          <h1 className="text-2xl font-bold mb-4">Inbox</h1>
        </div>
        {Object.keys(filters).length > 0 && (
          <div className="flex flex-row items-center space-x-1">
            <Button
              className="hover:bg-red-100"
              variant="ghost"
              size="sm"
              onClick={() => {
                dispatch(setFilters({}));
              }}
            >
              <X className="cursor-pointer" />
            </Button>
            <span className="text-sm text-muted-foreground">(filtered)</span>
          </div>
        )}
      </div>

      {error && (
        <div className="text-red-600 bg-red-50 p-3 rounded mb-4">{error}</div>
      )}

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          Loading emails...
        </div>
      ) : emails.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No emails found
        </div>
      ) : (
        <>
          <EmailList emails={filteredEmails} />
          {loadingMore && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              Loading more emails...
            </div>
          )}
          {!hasMore && emails.length > 0 && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              No more emails to load
            </div>
          )}
        </>
      )}
    </div>
  );
}
