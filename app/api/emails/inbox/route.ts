import { auth } from '@/auth';
import { fetchEmails } from '@/lib/gmail';
import { upsertEmails } from '@/lib/embeddings';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const pageToken = searchParams.get('pageToken') || undefined;
    const maxResults = parseInt(searchParams.get('maxResults') || '20');

    const result = await fetchEmails(session, maxResults, pageToken);

    // Index emails in Pinecone for semantic search (non-blocking)
    const emails = result.emails ?? [];
    if (emails.length > 0) {
      upsertEmails(
        emails.map((e) => ({
          id: e.id,
          from: e.from,
          subject: e.subject,
          preview: e.preview,
          date: e.date,
          unread: e.unread,
          bodyText: (e.body ?? '').slice(0, 500),
        }))
      ).catch((err) => console.warn('[embeddings] upsert failed:', err));
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in /api/emails/inbox:', error);
    return NextResponse.json(
      { error: 'Failed to fetch emails' },
      { status: 500 }
    );
  }
}
