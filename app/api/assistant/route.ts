import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { runAgent } from '@/lib/reactAgent';
import type { ContextMessage } from '@/lib/contextBuilder';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    message?: string;
    conversationHistory?: ContextMessage[];
    context?: { selectedEmailId?: string };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { message, conversationHistory = [], context = {} } = body;

  if (!message || typeof message !== 'string' || message.trim() === '') {
    return NextResponse.json({ error: 'message is required' }, { status: 400 });
  }

  try {
    const result = await runAgent(message.trim(), conversationHistory, {
      accessToken: session.accessToken as string,
      currentEmailId: context.selectedEmailId,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[assistant] error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
