import { NextResponse } from 'next/server';
import { serverStorage } from '@/lib/db/serverStorage';

export async function GET(request: Request) {
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
}

export async function POST(request: Request) {
  const session = await request.json();
  await serverStorage.saveSession(session);
  return NextResponse.json(session);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionCode = searchParams.get('code');

  if (!sessionCode) {
    return NextResponse.json({ error: 'Session code is required' }, { status: 400 });
  }

  await serverStorage.deleteSession(sessionCode);
  return NextResponse.json({ success: true });
} 