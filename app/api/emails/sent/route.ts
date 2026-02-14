import { auth } from '@/auth';
import { fetchSentEmails } from '@/lib/gmail';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const session = await auth();

    if (!session || !session.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const emails = await fetchSentEmails(session);

    return NextResponse.json({ emails });
  } catch (error) {
    console.error('Error in /api/emails/sent:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sent emails' },
      { status: 500 }
    );
  }
}
