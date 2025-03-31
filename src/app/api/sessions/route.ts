import { NextResponse } from 'next/server';
import { serverStorage } from '@/lib/db/serverStorage';

export const maxDuration = 8; // Set maximum duration to 8 seconds

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionCode = searchParams.get('code');

    if (sessionCode) {
      const session = await serverStorage.getSession(sessionCode);
      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      return NextResponse.json(session);
    }

    const sessions = await serverStorage.getAllSessions();
    return NextResponse.json(sessions);
  } catch (error) {
    console.error('Error in GET /api/sessions:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await request.json();
    await serverStorage.saveSession(session);
    return NextResponse.json(session);
  } catch (error) {
    console.error('Error in POST /api/sessions:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionCode = searchParams.get('code');

    if (!sessionCode) {
      return NextResponse.json({ error: 'Session code is required' }, { status: 400 });
    }

    await serverStorage.deleteSession(sessionCode);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/sessions:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 