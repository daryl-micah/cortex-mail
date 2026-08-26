'use client';

import { useAppSelector, useAppDispatch } from '@/store';
import EmailList from '../mail/components/EmailList';
import FilterPanel from '../mail/components/FilterPanel';
import { X } from 'lucide-react';
import { useMemo, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AIStatus } from '@/types/mail';
import {
  setFilters,
  appendEmails,
  setLoadingMore,
  setError,
} from '@/store/mailSlice';

interface InboxViewProps {
  statusFilter?: AIStatus;
  starredOnly?: boolean;
  title?: string;
}

export default function InboxView({
  statusFilter,
  starredOnly,
  title = 'Inbox',
}: InboxViewProps) {
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

    if (statusFilter) {
      result = result.filter((email) => email.ai?.status === statusFilter);
    }

    if (starredOnly) {
      result = result.filter((email) => email.starred);
    }

    if (filters.unread !== undefined) {
      result = result.filter((email) => email.unread === filters.unread);
    }

    if (filters.sender) {
      result = result.filter((email) =>
        email.from.toLowerCase().includes(filters.sender!.toLowerCase())
      );
    }

    if (filters.dateRange) {
      const now = new Date();
      const filterDate = new Date();

      switch (filters.dateRange) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          break;
        case 'yesterday':
          filterDate.setDate(now.getDate() - 1);
          filterDate.setHours(0, 0, 0, 0);
          break;
        case 'last-7-days':
          filterDate.setDate(now.getDate() - 7);
          break;
        case 'last-30-days':
          filterDate.setDate(now.getDate() - 30);
          break;
        case 'last-3-months':
          filterDate.setMonth(now.getMonth() - 3);
          break;
      }

      result = result.filter((email) => {
        const emailDate = new Date(email.date);
        return emailDate >= filterDate;
      });
    }

    return result;
  }, [emails, filters, statusFilter, starredOnly]);

  const unreadActive = filters.unread === true;

  return (
    <div
      ref={scrollContainerRef}
      className="w-full h-full overflow-y-auto no-scrollbar p-3 sm:p-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">{title}</h1>
          <div className="flex items-center gap-1 bevel rounded-md p-0.5 bg-surface-2">
            <button
              onClick={() => dispatch(setFilters({ ...filters, unread: undefined }))}
              className={cn(
                'px-2.5 py-1 rounded text-xs font-medium transition-colors',
                !unreadActive
                  ? 'bg-card text-foreground bevel'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              All
            </button>
            <button
              onClick={() => dispatch(setFilters({ ...filters, unread: true }))}
              className={cn(
                'px-2.5 py-1 rounded text-xs font-medium transition-colors',
                unreadActive
                  ? 'bg-card text-foreground bevel'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Unread
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <FilterPanel />
          {Object.keys(filters).length > 0 && (
            <div className="flex flex-row items-center space-x-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => dispatch(setFilters({}))}
                title="Clear filters"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
              <span className="chrome-label text-muted-foreground">filtered</span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="text-destructive bg-destructive/10 p-3 rounded-md mb-4 text-sm bevel">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Loading emails...
        </div>
      ) : filteredEmails.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No emails found
        </div>
      ) : (
        <>
          <EmailList emails={filteredEmails} />
          {loadingMore && (
            <div className="text-center py-4 chrome-label text-muted-foreground">
              Loading more…
            </div>
          )}
          {!hasMore && emails.length > 0 && (
            <div className="text-center py-4 chrome-label text-muted-foreground">
              {filteredEmails.length} of {emails.length}
            </div>
          )}
        </>
      )}
    </div>
  );
}
