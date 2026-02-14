'use client';

import { useEffect } from 'react';
import { useAppDispatch } from '@/store';
import {
  setEmails,
  setSentEmails,
  setLoading,
  setError,
} from '@/store/mailSlice';

export function useEmailSync() {
  const dispatch = useAppDispatch();

  const fetchInbox = async () => {
    try {
      dispatch(setLoading(true));
      const response = await fetch('/api/emails/inbox');

      if (!response.ok) {
        throw new Error('Failed to fetch emails');
      }

      const data = await response.json();
      dispatch(
        setEmails({
          emails: data.emails || [],
          nextPageToken: data.nextPageToken,
        })
      );
    } catch (error) {
      console.error('Error fetching inbox:', error);
      dispatch(setError('Failed to load emails'));
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
    fetchInbox();
    fetchSent();
  }, []);

  return { fetchInbox, fetchSent, sendEmail };
}
