import React from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Users, Clock, Mic, MicOff } from 'lucide-react';

interface Session {
  id: string;
  name: string;
  code: string;
  speakerName: string;
  listenerCount: number;
  isActive: boolean;
  createdAt: string;
  isSpeaking: boolean;
}

interface SessionListProps {
  sessions: Session[];
  onJoin: (code: string) => void;
  onEnd: (id: string) => void;
  isLoading?: boolean;
}

export const SessionList: React.FC<SessionListProps> = ({
  sessions,
  onJoin,
  onEnd,
  isLoading = false,
}) => {
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-4">
      {sessions.map((session) => (
        <Card key={session.id} className="p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <h3 className="font-medium">{session.name}</h3>
                <span className="text-sm text-muted-foreground">
                  Code: {session.code}
                </span>
              </div>
              <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                <div className="flex items-center space-x-1">
                  <Users className="h-4 w-4" />
                  <span>{session.listenerCount} listeners</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Clock className="h-4 w-4" />
                  <span>{formatTime(session.createdAt)}</span>
                </div>
                <div className="flex items-center space-x-1">
                  {session.isSpeaking ? (
                    <Mic className="h-4 w-4 text-green-500" />
                  ) : (
                    <MicOff className="h-4 w-4 text-red-500" />
                  )}
                  <span>{session.isSpeaking ? 'Speaking' : 'Silent'}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {session.isActive ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => onJoin(session.code)}
                    disabled={isLoading}
                  >
                    Join
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => onEnd(session.id)}
                    disabled={isLoading}
                  >
                    End
                  </Button>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">Ended</span>
              )}
            </div>
          </div>
        </Card>
      ))}
      {sessions.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No active sessions
        </div>
      )}
    </div>
  );
}; 