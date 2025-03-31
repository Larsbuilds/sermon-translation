'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface SessionTimeoutWarningProps {
  timeRemaining: number;
  onExtendSession: () => void;
}

export function SessionTimeoutWarning({
  timeRemaining,
  onExtendSession,
}: SessionTimeoutWarningProps) {
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="p-4 bg-yellow-50 border-yellow-200">
      <div className="flex items-center space-x-4">
        <AlertTriangle className="h-5 w-5 text-yellow-600" />
        <div className="flex-1">
          <p className="text-sm font-medium text-yellow-800">
            Session will end in {formatTime(timeRemaining)}
          </p>
          <p className="text-sm text-yellow-700">
            Extend the session to continue speaking
          </p>
        </div>
        <Button
          onClick={onExtendSession}
          variant="outline"
          className="text-yellow-800 border-yellow-300 hover:bg-yellow-100"
        >
          Extend Session
        </Button>
      </div>
    </Card>
  );
} 