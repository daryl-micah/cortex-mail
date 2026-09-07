import { auth } from '@/auth';
import { classifyEmails, type ClassifiableEmail } from '@/lib/classifier';
import type { EmailClassification } from '@/lib/schemas';
import { NextRequest, NextResponse } from 'next/server';

// Process-lifetime cache — avoids re-classifying the same message id on
// every poll. Not persisted; fine for a single-instance dev/demo deployment.
const cache = new Map<string, EmailClassification>();

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { emails } = (await request.json()) as {
      emails: ClassifiableEmail[];
    };

    if (!Array.isArray(emails)) {
      return NextResponse.json({ error: 'Missing emails' }, { status: 400 });
    }

    const cached: EmailClassification[] = [];
    const toClassify: ClassifiableEmail[] = [];

    for (const email of emails) {
      const hit = cache.get(email.id);
      if (hit) {
        cached.push(hit);
      } else {
        toClassify.push(email);
      }
    }

    let fresh: EmailClassification[] = [];
    if (toClassify.length > 0) {
      fresh = await classifyEmails(toClassify);
      for (const c of fresh) {
        cache.set(c.id, c);
      }
    }

    return NextResponse.json({ classifications: [...cached, ...fresh] });
  } catch (error) {
    console.error('Error in /api/emails/classify:', error);
    return NextResponse.json(
      { error: 'Failed to classify emails' },
      { status: 500 }
    );
  }
}
