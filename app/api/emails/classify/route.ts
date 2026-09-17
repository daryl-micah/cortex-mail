import { auth } from '@/auth';
import {
  classifyEmails,
  isClassifierConfigured,
  type ClassifiableEmail,
} from '@/lib/classifier';
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

    // Say so plainly rather than returning a page of unclassified emails that
    // look like the model read them and had no opinion.
    if (!isClassifierConfigured()) {
      return NextResponse.json(
        { error: 'Classification is off: GROQ_API_KEY is not set on the server.' },
        { status: 503 }
      );
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
      try {
        fresh = await classifyEmails(toClassify);
      } catch (err) {
        // Every batch failed. Pass the real reason back so the UI can say what
        // went wrong instead of showing an inbox with no opinions on it.
        const detail = err instanceof Error ? err.message : String(err);
        console.error('[classify] all batches failed:', detail);
        return NextResponse.json(
          { error: `Classification failed: ${detail}` },
          { status: 502 }
        );
      }
      for (const c of fresh) {
        // Don't cache a failure — the client stops asking on its own (the
        // email now has a status), so a reload gets a fresh attempt.
        if (c.status !== 'unclassified') cache.set(c.id, c);
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
