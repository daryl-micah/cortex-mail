import { auth } from '@/auth';
import { setStarred } from '@/lib/gmail';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { messageId, starred } = await request.json();

    if (!messageId || typeof starred !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing messageId or starred' },
        { status: 400 }
      );
    }

    await setStarred(session, messageId, starred);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in /api/emails/star:', error);
    return NextResponse.json(
      { error: 'Failed to update starred state' },
      { status: 500 }
    );
  }
}
