'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Users, Mic, MicOff } from 'lucide-react';
import { Session } from '@/app/contexts/SessionContext';

interface SessionStatusProps {
  session: Session;
  duration: number;
  timeRemaining: number;
  onExtendSession: () => void;
  onEndSession: () => void;
}

export function SessionStatus({
  session,
  duration,
  timeRemaining,
  onExtendSession,
  onEndSession,
}: SessionStatusProps) {
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="p-6 mb-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">{session.name}</h2>
          <p className="text-gray-600">Code: {session.sessionCode}</p>
          <p className="text-gray-600">Listeners: {session.listenerCount}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold">Time Remaining: {formatTime(timeRemaining)}</p>
          <div className="space-x-2 mt-2">
            <Button onClick={onExtendSession} variant="outline">
              Extend Session
            </Button>
            <Button onClick={onEndSession} variant="destructive">
              End Session
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
} 