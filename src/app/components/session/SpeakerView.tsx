import React, { useState } from 'react';
import { useSession } from '@/contexts/SessionContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Share2 } from 'lucide-react';

interface SpeakerViewProps {
  sessionCode: string;
}

export default function SpeakerView({ sessionCode }: SpeakerViewProps) {
  const { currentSession } = useSession();
  const [isRecording, setIsRecording] = useState(false);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/session/${sessionCode}`);
      alert('Session link copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    // Implement recording logic here
  };

  if (!currentSession) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Session Not Found</h2>
          <p className="text-muted-foreground">Please check the session code and try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">{currentSession.name}</h2>
            <Button
              variant="outline"
              size="icon"
              onClick={handleShare}
              className="rounded-full"
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Speaker: {currentSession.speaker}</span>
              <span>Status: {currentSession.status}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              Listeners: {currentSession.listeners}
            </div>
          </div>

          <div className="mt-6">
            <Button
              onClick={toggleRecording}
              className="w-full"
              variant={isRecording ? "destructive" : "default"}
            >
              {isRecording ? (
                <>
                  <MicOff className="mr-2 h-4 w-4" />
                  Stop Recording
                </>
              ) : (
                <>
                  <Mic className="mr-2 h-4 w-4" />
                  Start Recording
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
} 