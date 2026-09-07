import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { fetchEmailById } from '@/lib/gmail';

/**
 * Fetch one message by id. Used when the client needs an email it never
 * loaded into the store — a semantic-search hit, or an agent-proposed action
 * on mail outside the current inbox page.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const email = await fetchEmailById(session, id);
  if (!email) {
    return NextResponse.json({ error: 'Email not found' }, { status: 404 });
  }

  return NextResponse.json({ email });
}
