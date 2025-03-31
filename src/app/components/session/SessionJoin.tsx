import React from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Mic, MicOff } from 'lucide-react';

interface SessionJoinProps {
  sessionCode: string;
  onJoin: (code: string) => void;
  isJoining: boolean;
  error?: string;
}

export const SessionJoin: React.FC<SessionJoinProps> = ({
  sessionCode,
  onJoin,
  isJoining,
  error,
}) => {
  const [code, setCode] = React.useState(sessionCode);
  const [isMicEnabled, setIsMicEnabled] = React.useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onJoin(code);
  };

  const toggleMic = async () => {
    try {
      if (isMicEnabled) {
        // Stop microphone
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
      } else {
        // Start microphone
        await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      setIsMicEnabled(!isMicEnabled);
    } catch (err) {
      console.error('Error toggling microphone:', err);
    }
  };

  return (
    <Card className="p-6 max-w-md w-full mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="sessionCode">Session Code</Label>
          <Input
            id="sessionCode"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter session code"
            required
            disabled={isJoining}
          />
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
        </div>
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={toggleMic}
            className="h-10 w-10"
          >
            {isMicEnabled ? (
              <Mic className="h-5 w-5" />
            ) : (
              <MicOff className="h-5 w-5" />
            )}
          </Button>
          <Button type="submit" disabled={isJoining}>
            {isJoining ? 'Joining...' : 'Join Session'}
          </Button>
        </div>
      </form>
    </Card>
  );
}; 