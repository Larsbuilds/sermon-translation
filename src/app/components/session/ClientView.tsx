import React, { useEffect, useState } from 'react';
import { useSession } from '@/contexts/SessionContext';
import { useTranslation } from '@/contexts/TranslationContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Volume2, VolumeX } from 'lucide-react';

interface ClientViewProps {
  sessionCode: string;
}

export default function ClientView({ sessionCode }: ClientViewProps) {
  const { currentSession } = useSession();
  const { currentTranslation, isPlaying, togglePlayback } = useTranslation();
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (currentSession?.audioUrl) {
      const audio = new Audio(currentSession.audioUrl);
      audio.controls = true;
      audio.style.width = '100%';
      setAudioElement(audio);

      return () => {
        audio.pause();
        audio.src = '';
      };
    }
  }, [currentSession?.audioUrl]);

  useEffect(() => {
    if (audioElement) {
      if (isPlaying) {
        audioElement.play();
      } else {
        audioElement.pause();
      }
    }
  }, [isPlaying, audioElement]);

  const handleMuteToggle = () => {
    if (audioElement) {
      audioElement.muted = !isMuted;
      setIsMuted(!isMuted);
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
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handleMuteToggle}
                className="rounded-full"
              >
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Speaker: {currentSession.speaker}</span>
              <span>Status: {currentSession.status}</span>
            </div>
          </div>

          {audioElement && (
            <div className="mt-4">
              {audioElement}
            </div>
          )}

          {currentTranslation && (
            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <h3 className="font-semibold">Original Text</h3>
                <p className="text-muted-foreground">{currentTranslation.originalText}</p>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold">Translation</h3>
                <p>{currentTranslation.translatedText}</p>
              </div>
              <Progress value={currentTranslation.progress} className="w-full" />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
} 