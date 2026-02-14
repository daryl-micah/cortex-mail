import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getGmailClient } from '@/lib/gmail';

export async function GET(request: NextRequest) {
  const session = await getServerSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const messageId = searchParams.get('messageId');
  const attachmentId = searchParams.get('attachmentId');

  if (!messageId || !attachmentId) {
    return NextResponse.json(
      { error: 'Missing messageId or attachmentId' },
      { status: 400 }
    );
  }

  try {
    const gmail = getGmailClient(session as any);

    const attachment = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId: messageId,
      id: attachmentId,
    });

    if (!attachment.data.data) {
      return NextResponse.json(
        { error: 'Attachment not found' },
        { status: 404 }
      );
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(attachment.data.data, 'base64');

    // Determine content type (default to octet-stream)
    const contentType =
      searchParams.get('mimeType') || 'application/octet-stream';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error fetching attachment:', error);
    return NextResponse.json(
      { error: 'Failed to fetch attachment' },
      { status: 500 }
    );
  }
}
