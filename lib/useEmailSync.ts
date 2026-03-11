'use client';

import { useEffect, useRef } from 'react';
import { useAppDispatch } from '@/store';
import {
  setEmails,
  setSentEmails,
  setLoading,
  setError,
} from '@/store/mailSlice';
import { upsertEmails } from './embeddings';

const POLL_INTERVAL = 30000; // 30 seconds

export function useEmailSync() {
  const dispatch = useAppDispatch();
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchInbox = async () => {
    try {
      dispatch(setLoading(true));
      const response = await fetch('/api/emails/inbox');

      if (!response.ok) {
        throw new Error('Failed to fetch emails');
      }

      const data = await response.json();
      const emails = data.emails || [];
      dispatch(setEmails({ emails, nextPageToken: data.nextPageToken }));

      // Index emails in Pinecone for semantic search (non-blocking)
      upsertEmails(
        emails.map((e: any) => ({
          id: e.id,
          from: e.from,
          subject: e.subject,
          preview: e.preview,
          date: e.date,
          unread: e.unread,
          bodyText: e.body?.slice(0, 500),
        }))
      ).catch((err) => console.warn('[embeddings] upsert failed:', err));
    } catch (error) {
      console.error('Error fetching inbox:', error);
      dispatch(setError('Failed to load emails'));
    }
  };

  const fetchInboxSilently = async () => {
    try {
      const response = await fetch('/api/emails/inbox');
      if (response.ok) {
        const data = await response.json();
        const emails = data.emails || [];
        dispatch(setEmails({ emails, nextPageToken: data.nextPageToken }));

        // Keep Pinecone index up-to-date on silent refreshes too
        upsertEmails(
          emails.map((e: any) => ({
            id: e.id,
            from: e.from,
            subject: e.subject,
            preview: e.preview,
            date: e.date,
            unread: e.unread,
            bodyText: e.body?.slice(0, 500),
          }))
        ).catch((err) =>
          console.warn('[embeddings] silent upsert failed:', err)
        );
      }
    } catch (error) {
      console.error('Silent inbox refresh failed:', error);
    }
  };

  const fetchSent = async () => {
    try {
      const response = await fetch('/api/emails/sent');

      if (!response.ok) {
        throw new Error('Failed to fetch sent emails');
      }

      const data = await response.json();
      dispatch(setSentEmails(data.emails || []));
    } catch (error) {
      console.error('Error fetching sent emails:', error);
    }
  };

  const sendEmail = async (to: string, subject: string, body: string) => {
    try {
      const response = await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, body }),
      });

      if (!response.ok) {
        throw new Error('Failed to send email');
      }

      // Refresh sent emails after sending
      await fetchSent();
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchInbox();
    fetchSent();

    // Set up polling for inbox updates
    pollIntervalRef.current = setInterval(() => {
      fetchInboxSilently();
    }, POLL_INTERVAL);

    // Cleanup on unmount
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  return { fetchInbox, fetchSent, sendEmail };
}
