import { auth } from '@/auth';
import { generateInsight } from '@/lib/insight';
import type { Insight } from '@/lib/schemas';
import { NextRequest, NextResponse } from 'next/server';

// Process-lifetime cache keyed by message id — same shape as /classify.
const cache = new Map<string, Insight | null>();

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { emailId, subject, fromName, body } = (await request.json()) as {
      emailId?: string;
      subject?: string;
      fromName?: string;
      body?: string;
    };

    if (!emailId || typeof body !== 'string' || body.trim() === '') {
      return NextResponse.json({ error: 'emailId and body are required' }, { status: 400 });
    }

    if (cache.has(emailId)) {
      return NextResponse.json({ insight: cache.get(emailId) });
    }

    const insight = await generateInsight({
      subject: subject ?? '',
      fromName: fromName ?? '',
      body,
      userName: session.user?.name ?? undefined,
    });
    cache.set(emailId, insight);

    return NextResponse.json({ insight });
  } catch (error) {
    console.error('Error in /api/emails/insight:', error);
    return NextResponse.json({ error: 'Failed to generate insight' }, { status: 500 });
  }
}
