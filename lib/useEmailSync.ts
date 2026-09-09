'use client';

import { useEffect, useRef } from 'react';
import { useAppDispatch } from '@/store';
import {
  setEmails,
  setSentEmails,
  setLoading,
  setError,
  setClassifications,
  setClassifying,
} from '@/store/mailSlice';
import type { Email, EmailAI } from '@/types/mail';

const POLL_INTERVAL = 30000; // 30 seconds

async function classifyAndDispatch(
  emails: Email[],
  dispatch: ReturnType<typeof useAppDispatch>
) {
  const unclassified = emails.filter((e) => !e.ai);
  if (unclassified.length === 0) return;

  dispatch(setClassifying(true));

  try {
    const response = await fetch('/api/emails/classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emails: unclassified.map((e) => ({
          id: e.id,
          fromName: e.fromName,
          subject: e.subject,
          preview: e.preview,
          date: e.date,
        })),
      }),
    });

    if (!response.ok) {
      dispatch(setClassifying(false));
      return;
    }

    const data = await response.json();
    const classifications: Array<EmailAI & { id: string }> =
      data.classifications || [];

    const byId: Record<string, EmailAI> = {};
    for (const c of classifications) {
      const { id, ...ai } = c;
      byId[id] = ai;
    }

    // Always dispatch, even when empty — setClassifications clears the
    // classifying flag, which is what lets the Today view stop waiting.
    dispatch(setClassifications(byId));
  } catch (error) {
    console.warn('Email classification failed:', error);
    dispatch(setClassifying(false));
  }
}

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
      const emails: Email[] = data.emails || [];
      dispatch(setEmails({ emails, nextPageToken: data.nextPageToken }));
      classifyAndDispatch(emails, dispatch);
    } catch (error) {
      console.error('Error fetching inbox:', error);
      dispatch(setError('Failed to load emails, please sign-in again.'));
    }
  };

  const fetchInboxSilently = async () => {
    try {
      const response = await fetch('/api/emails/inbox');
      if (response.ok) {
        const data = await response.json();
        const emails: Email[] = data.emails || [];
        dispatch(setEmails({ emails, nextPageToken: data.nextPageToken }));
        classifyAndDispatch(emails, dispatch);
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
      dispatch(setError('Failed to load sent emails, please sign-in again.'));
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
    // Runs once on mount; the fetchers close over dispatch only and never change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { fetchInbox, fetchSent, sendEmail };
}
