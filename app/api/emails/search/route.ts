import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { searchEmails } from '@/lib/embeddings';
import { getUserKey } from '@/lib/session';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { query?: string; topK?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { query, topK = 10 } = body;
  const userKey = getUserKey(session);
  if (!userKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!query || typeof query !== 'string' || query.trim() === '') {
    return NextResponse.json({ error: 'query is required' }, { status: 400 });
  }

  try {
    const results = await searchEmails(userKey, query.trim(), topK);
    return NextResponse.json({ results });
  } catch (error) {
    console.error('[search] error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
