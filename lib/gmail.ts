import { google } from 'googleapis';
import { Session } from 'next-auth';

/**
 * Initialize Gmail API client with user's access token
 */
export function getGmailClient(session: Session) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.NEXTAUTH_URL
  );

  oauth2Client.setCredentials({
    access_token: session.accessToken,
    refresh_token: session.refreshToken,
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

/**
 * Fetch emails from Gmail
 */
export async function fetchEmails(
  session: Session,
  maxResults = 20,
  pageToken?: string
) {
  const gmail = getGmailClient(session);

  try {
    // Get list of message IDs
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults,
      labelIds: ['INBOX'],
      pageToken: pageToken,
    });

    const messages = response.data.messages || [];

    // Fetch full message details for each email
    const emailPromises = messages.map(async (message) => {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: message.id!,
        format: 'full',
      });

      const headers = msg.data.payload?.headers || [];
      const getHeader = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())
          ?.value || '';

      // Get email body (both plain text and HTML)
      let body = '';
      let htmlBody = '';
      const attachments: any[] = [];

      // Recursive function to extract body and attachments from parts
      const extractContent = (parts: any[]) => {
        for (const part of parts) {
          if (part.parts) {
            // Recursively handle multipart
            extractContent(part.parts);
          } else if (
            part.mimeType === 'text/plain' &&
            !body &&
            part.body?.data
          ) {
            body = Buffer.from(part.body.data, 'base64').toString('utf-8');
          } else if (part.mimeType === 'text/html' && part.body?.data) {
            htmlBody = Buffer.from(part.body.data, 'base64').toString('utf-8');
          } else if (part.filename && part.body?.attachmentId) {
            // Handle attachments (including inline images)
            attachments.push({
              attachmentId: part.body.attachmentId,
              filename: part.filename,
              mimeType: part.mimeType || 'application/octet-stream',
              size: part.body.size || 0,
              isInline: part.headers?.some(
                (h: any) =>
                  h.name.toLowerCase() === 'content-disposition' &&
                  h.value.includes('inline')
              ),
              contentId: part.headers
                ?.find((h: any) => h.name.toLowerCase() === 'content-id')
                ?.value?.replace(/[<>]/g, ''),
            });
          }
        }
      };

      const parts = msg.data.payload?.parts || [];
      if (parts.length > 0) {
        extractContent(parts);
      } else if (msg.data.payload?.body?.data) {
        // Simple message without parts
        const mimeType = msg.data.payload.mimeType;
        const bodyData = Buffer.from(
          msg.data.payload.body.data,
          'base64'
        ).toString('utf-8');
        if (mimeType === 'text/html') {
          htmlBody = bodyData;
        } else {
          body = bodyData;
        }
      }

      return {
        id: msg.data.id!,
        from: getHeader('From'),
        subject: getHeader('Subject'),
        preview:
          body.substring(0, 100) ||
          htmlBody.replace(/<[^>]*>/g, '').substring(0, 100),
        body: body,
        htmlBody: htmlBody || undefined,
        date: new Date(parseInt(msg.data.internalDate || '0')).toLocaleString(),
        unread: msg.data.labelIds?.includes('UNREAD') || false,
        threadId: msg.data.threadId,
        attachments: attachments.length > 0 ? attachments : undefined,
      };
    });

    const emails = await Promise.all(emailPromises);
    return {
      emails,
      nextPageToken: response.data.nextPageToken,
    };
  } catch (error) {
    console.error('Error fetching emails:', error);
    throw new Error('Failed to fetch emails from Gmail');
  }
}

/**
 * Send an email through Gmail
 */
export async function sendEmail(
  session: Session,
  to: string,
  subject: string,
  body: string
) {
  const gmail = getGmailClient(session);

  try {
    const email = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      body,
    ].join('\n');

    const encodedEmail = Buffer.from(email)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedEmail,
      },
    });

    return response.data;
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Failed to send email through Gmail');
  }
}

/**
 * Mark email as read
 */
export async function markAsRead(session: Session, messageId: string) {
  const gmail = getGmailClient(session);

  try {
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        removeLabelIds: ['UNREAD'],
      },
    });
  } catch (error) {
    console.error('Error marking email as read:', error);
    throw new Error('Failed to mark email as read');
  }
}

/**
 * Fetch sent emails
 */
export async function fetchSentEmails(session: Session, maxResults = 20) {
  const gmail = getGmailClient(session);

  try {
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults,
      labelIds: ['SENT'],
    });

    const messages = response.data.messages || [];

    const emailPromises = messages.map(async (message) => {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: message.id!,
        format: 'full',
      });

      const headers = msg.data.payload?.headers || [];
      const getHeader = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())
          ?.value || '';

      let body = '';
      const parts = msg.data.payload?.parts || [];
      if (parts.length > 0) {
        const textPart = parts.find((part) => part.mimeType === 'text/plain');
        if (textPart?.body?.data) {
          body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
        }
      } else if (msg.data.payload?.body?.data) {
        body = Buffer.from(msg.data.payload.body.data, 'base64').toString(
          'utf-8'
        );
      }

      return {
        id: msg.data.id!,
        from: 'Me',
        to: getHeader('To'),
        subject: getHeader('Subject'),
        preview: body.substring(0, 100),
        body: body,
        date: new Date(parseInt(msg.data.internalDate || '0')).toLocaleString(),
        unread: false,
      };
    });

    return await Promise.all(emailPromises);
  } catch (error) {
    console.error('Error fetching sent emails:', error);
    throw new Error('Failed to fetch sent emails');
  }
}
