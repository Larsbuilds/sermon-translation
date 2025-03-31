import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface SessionTimeoutWarningProps {
  timeRemaining: number;
  onExtend: () => void;
  onEnd: () => void;
}

export const SessionTimeoutWarning: React.FC<SessionTimeoutWarningProps> = ({
  timeRemaining,
  onExtend,
  onEnd,
}) => {
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;

  return (
    <Card className="fixed bottom-4 right-4 p-4 bg-yellow-50 border-yellow-200">
      <div className="flex items-start space-x-3">
        <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-sm font-medium text-yellow-800">
            Session Timeout Warning
          </h3>
          <p className="text-sm text-yellow-700 mt-1">
            Your session will end in {minutes}:{seconds.toString().padStart(2, '0')}
          </p>
          <div className="mt-3 flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onExtend}
              className="text-yellow-700 border-yellow-300 hover:bg-yellow-100"
            >
              Extend Session
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={onEnd}
            >
              End Session
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}; 