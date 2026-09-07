import { auth } from '@/auth';
import { modifyMessages, type ModifyOp } from '@/lib/gmail';
import { NextRequest, NextResponse } from 'next/server';

const OPS: ModifyOp[] = ['archive', 'unarchive', 'read', 'unread', 'star', 'unstar'];

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ids, op } = (await request.json()) as { ids?: string[]; op?: ModifyOp };

    if (!Array.isArray(ids) || ids.length === 0 || !op || !OPS.includes(op)) {
      return NextResponse.json({ error: 'ids[] and a valid op are required' }, { status: 400 });
    }

    await modifyMessages(session, ids, op);
    return NextResponse.json({ success: true, count: ids.length });
  } catch (error) {
    console.error('Error in /api/emails/modify:', error);
    return NextResponse.json({ error: 'Failed to modify messages' }, { status: 500 });
  }
}
