import { NextResponse } from 'next/server';
import { serverStorage } from '@/lib/db/serverStorage';

export async function POST(request: Request) {
  try {
    const { timeout } = await request.json();
    const sessions = await serverStorage.getAllSessions();
    
    const now = new Date();
    const updatedSessions = await Promise.all(
      sessions.map(async (session) => {
        if (session.status === 'active') {
          const sessionAge = now.getTime() - new Date(session.createdAt).getTime();
          if (sessionAge > timeout) {
            const updatedSession = {
              ...session,
              status: 'ended',
              endedAt: now
            };
            await serverStorage.saveSession(updatedSession);
            return updatedSession;
          }
        }
        return session;
      })
    );

    return NextResponse.json(updatedSessions);
  } catch (error) {
    console.error('Error in POST /api/sessions/cleanup:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 