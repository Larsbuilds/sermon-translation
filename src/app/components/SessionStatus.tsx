import React from 'react';
import { Clock, Users, Mic, MicOff } from 'lucide-react';
import { Card } from '../../components/ui/card';

interface SessionStatusProps {
  isActive: boolean;
  duration: number;
  listenerCount: number;
  isSpeaking: boolean;
}

export const SessionStatus: React.FC<SessionStatusProps> = ({
  isActive,
  duration,
  listenerCount,
  isSpeaking,
}) => {
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="p-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="flex items-center space-x-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">{formatDuration(duration)}</p>
            <p className="text-xs text-muted-foreground">Duration</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">{listenerCount}</p>
            <p className="text-xs text-muted-foreground">Listeners</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {isSpeaking ? (
            <Mic className="h-4 w-4 text-green-500" />
          ) : (
            <MicOff className="h-4 w-4 text-red-500" />
          )}
          <div>
            <p className="text-sm font-medium">
              {isSpeaking ? 'Speaking' : 'Silent'}
            </p>
            <p className="text-xs text-muted-foreground">Status</p>
          </div>
        </div>
      </div>
    </Card>
  );
}; 