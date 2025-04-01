import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(req: Request) {
  return NextResponse.json({ message: 'WebSocket server is running' });
} 