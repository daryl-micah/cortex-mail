import { google, type gmail_v1 } from 'googleapis';
import { Session } from 'next-auth';
import { buildPreview, parseSender } from './emailNormalize';
import type { EmailAttachment, EmailCategory } from '@/types/mail';

function categoryFromLabels(labelIds: string[] | undefined): EmailCategory {
  if (!labelIds) return 'primary';
  if (labelIds.includes('CATEGORY_PROMOTIONS')) return 'promotions';
  if (labelIds.includes('CATEGORY_UPDATES')) return 'updates';
  if (labelIds.includes('CATEGORY_SOCIAL')) return 'social';
  if (labelIds.includes('CATEGORY_FORUMS')) return 'forums';
  return 'primary';
}

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
 * Turn a raw Gmail message into the app's `Email` shape: body, HTML body,
 * attachments, sender, and the headers we thread replies with.
 *
 * Shared by the inbox listing and the single-message fetch so a message
 * opened from search looks identical to one opened from the list.
 */
export function normalizeMessage(data: gmail_v1.Schema$Message) {
  const headers = data.payload?.headers || [];
  const getHeader = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ||
    '';

  // Get email body (both plain text and HTML)
  let body = '';
  let htmlBody = '';
  const attachments: EmailAttachment[] = [];

  // Recursive function to extract body and attachments from parts
  const extractContent = (parts: gmail_v1.Schema$MessagePart[]) => {
    for (const part of parts) {
      if (part.parts) {
        // Recursively handle multipart
        extractContent(part.parts);
      } else if (part.mimeType === 'text/plain' && !body && part.body?.data) {
        body = Buffer.from(part.body.data, 'base64').toString('utf-8');
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        htmlBody = Buffer.from(part.body.data, 'base64').toString('utf-8');
      } else if (part.filename && part.body?.attachmentId) {
        const partHeaders = part.headers ?? [];
        // Handle attachments (including inline images)
        attachments.push({
          attachmentId: part.body.attachmentId,
          filename: part.filename,
          mimeType: part.mimeType || 'application/octet-stream',
          size: part.body.size || 0,
          isInline: partHeaders.some(
            (h) =>
              h.name?.toLowerCase() === 'content-disposition' &&
              !!h.value?.includes('inline')
          ),
          contentId: partHeaders
            .find((h) => h.name?.toLowerCase() === 'content-id')
            ?.value?.replace(/[<>]/g, ''),
        });
      }
    }
  };

  const parts = data.payload?.parts || [];
  if (parts.length > 0) {
    extractContent(parts);
  } else if (data.payload?.body?.data) {
    // Simple message without parts
    const mimeType = data.payload.mimeType;
    const bodyData = Buffer.from(data.payload.body.data, 'base64').toString(
      'utf-8'
    );
    if (mimeType === 'text/html') {
      htmlBody = bodyData;
    } else {
      body = bodyData;
    }
  }

  const fromHeader = getHeader('From');
  const sender = parseSender(fromHeader);

  return {
    id: data.id!,
    from: fromHeader,
    fromName: sender.name,
    fromEmail: sender.email,
    initials: sender.initials,
    subject: getHeader('Subject'),
    preview: buildPreview(body || htmlBody, 140),
    body: body,
    htmlBody: htmlBody || undefined,
    date: new Date(parseInt(data.internalDate || '0')).toISOString(),
    unread: data.labelIds?.includes('UNREAD') || false,
    starred: data.labelIds?.includes('STARRED') || false,
    category: categoryFromLabels(data.labelIds || undefined),
    threadId: data.threadId,
    messageId: getHeader('Message-ID') || undefined,
    attachments: attachments.length > 0 ? attachments : undefined,
  };
}

/**
 * Fetch a single message by id, regardless of whether it is still in the
 * inbox. Search hits and agent-proposed actions can reference archived mail
 * or mail from a page the client never loaded.
 */
export async function fetchEmailById(session: Session, id: string) {
  const gmail = getGmailClient(session);

  try {
    const msg = await gmail.users.messages.get({
      userId: 'me',
      id,
      format: 'full',
    });
    return normalizeMessage(msg.data);
  } catch (error) {
    console.error('Error fetching email by id:', error);
    return null;
  }
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
      return normalizeMessage(msg.data);
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
  body: string,
  threading?: { threadId?: string; inReplyTo?: string }
) {
  const gmail = getGmailClient(session);

  try {
    const headers = [`To: ${to}`, `Subject: ${subject}`];
    // Reply headers so Gmail threads the message under the original
    if (threading?.inReplyTo) {
      headers.push(`In-Reply-To: ${threading.inReplyTo}`);
      headers.push(`References: ${threading.inReplyTo}`);
    }
    const email = [
      ...headers,
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
        threadId: threading?.threadId,
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
 * Star or unstar an email
 */
export async function setStarred(
  session: Session,
  messageId: string,
  starred: boolean
) {
  const gmail = getGmailClient(session);

  try {
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: starred
        ? { addLabelIds: ['STARRED'] }
        : { removeLabelIds: ['STARRED'] },
    });
  } catch (error) {
    console.error('Error setting starred state:', error);
    throw new Error('Failed to update starred state');
  }
}

export type ModifyOp =
  | 'archive'
  | 'unarchive'
  | 'read'
  | 'unread'
  | 'star'
  | 'unstar';

const MODIFY_LABELS: Record<
  ModifyOp,
  { addLabelIds?: string[]; removeLabelIds?: string[] }
> = {
  archive: { removeLabelIds: ['INBOX'] },
  unarchive: { addLabelIds: ['INBOX'] },
  read: { removeLabelIds: ['UNREAD'] },
  unread: { addLabelIds: ['UNREAD'] },
  star: { addLabelIds: ['STARRED'] },
  unstar: { removeLabelIds: ['STARRED'] },
};

/**
 * Apply one label operation to many messages in a single batchModify call.
 * Gmail caps a batch at 1000 ids.
 */
export async function modifyMessages(
  session: Session,
  ids: string[],
  op: ModifyOp
) {
  if (ids.length === 0) return;
  const gmail = getGmailClient(session);

  try {
    for (let i = 0; i < ids.length; i += 1000) {
      await gmail.users.messages.batchModify({
        userId: 'me',
        requestBody: { ids: ids.slice(i, i + 1000), ...MODIFY_LABELS[op] },
      });
    }
  } catch (error) {
    console.error(`Error applying ${op}:`, error);
    throw new Error(`Failed to ${op} messages`);
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

      const toHeader = getHeader('To');

      return {
        id: msg.data.id!,
        from: 'Me',
        fromName: 'Me',
        fromEmail: '',
        initials: 'ME',
        to: toHeader,
        subject: getHeader('Subject'),
        preview: buildPreview(body, 140),
        body: body,
        date: new Date(parseInt(msg.data.internalDate || '0')).toISOString(),
        unread: false,
        starred: msg.data.labelIds?.includes('STARRED') || false,
        category: categoryFromLabels(msg.data.labelIds || undefined),
      };
    });

    return await Promise.all(emailPromises);
  } catch (error) {
    console.error('Error fetching sent emails:', error);
    throw new Error('Failed to fetch sent emails');
  }
}
