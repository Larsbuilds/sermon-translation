import React, { useState, useEffect } from 'react';
import { useSession } from '../../contexts/SessionContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Share2, Copy, Link } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import AudioCapture from '../audio/AudioCapture';

interface SpeakerViewProps {
  sessionCode: string;
}

export default function SpeakerView({ sessionCode }: SpeakerViewProps) {
  const { currentSession } = useSession();
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);

  // Request microphone permission when component mounts
  useEffect(() => {
    const requestMicrophonePermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
        stream.getTracks().forEach(track => track.stop());
        toast.success('Microphone access granted');
        setHasPermission(true);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to access microphone');
        if (error.name === 'NotAllowedError') {
          toast.error('Microphone access denied. Please allow microphone access in your browser settings.');
        } else if (error.name === 'NotFoundError') {
          toast.error('No microphone found. Please connect a microphone and try again.');
        } else {
          toast.error('Failed to access microphone: ' + error.message);
        }
      }
    };

    requestMicrophonePermission();
  }, []);

  const handleStartRecording = () => {
    if (hasPermission) {
      setIsRecording(true);
    } else {
      toast.error('Please grant microphone access first');
    }
  };

  const handleStopRecording = () => {
    setIsRecording(false);
  };

  const handleShareLink = async () => {
    try {
      const shareUrl = `${window.location.origin}/session/${sessionCode}`;
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Session link copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy link:', err);
      toast.error('Failed to copy link');
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(sessionCode);
      toast.success('Session code copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy code:', err);
      toast.error('Failed to copy code');
    }
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
              onClick={() => setShowShareOptions(!showShareOptions)}
              className="rounded-full"
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
          
          {showShareOptions && (
            <div className="space-y-4 p-4 bg-muted rounded-lg">
              <div className="space-y-2">
                <Label>Share Link</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={`${window.location.origin}/session/${sessionCode}`}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleShareLink}
                    className="shrink-0"
                  >
                    <Link className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Session Code</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={sessionCode}
                    className="flex-1 font-mono text-center tracking-wider"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyCode}
                    className="shrink-0"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Speaker: {currentSession.speaker}</span>
              <span>Status: {currentSession.status}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              Listeners: {currentSession.listenerCount}
            </div>
          </div>

          {/* Recording Controls */}
          <div className="mt-6">
            <Button
              onClick={isRecording ? handleStopRecording : handleStartRecording}
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

          {/* Audio Capture Component */}
          {isRecording && hasPermission && (
            <div className="mt-6">
              <AudioCapture
                isActive={true}
                isSpeaker={true}
                sessionId={currentSession.id}
                onAudioData={(frequencyData, timeData) => {
                  // Handle audio data if needed
                }}
                onQualityUpdate={(metrics) => {
                  // Handle quality updates if needed
                }}
                onError={(error) => {
                  toast.error(error.message);
                }}
              />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
} 