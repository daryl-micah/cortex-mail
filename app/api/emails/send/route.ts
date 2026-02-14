import { auth } from '@/auth';
import { sendEmail } from '@/lib/gmail';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { to, subject, body } = await request.json();

    if (!to || !subject) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject' },
        { status: 400 }
      );
    }

    const result = await sendEmail(session, to, subject, body || '');

    return NextResponse.json({ success: true, messageId: result.id });
  } catch (error) {
    console.error('Error in /api/emails/send:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}
