import { auth } from '@/auth';
import { fetchEmails } from '@/lib/gmail';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const session = await auth();

    if (!session || !session.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const emails = await fetchEmails(session);

    return NextResponse.json({ emails });
  } catch (error) {
    console.error('Error in /api/emails/inbox:', error);
    return NextResponse.json(
      { error: 'Failed to fetch emails' },
      { status: 500 }
    );
  }
}
