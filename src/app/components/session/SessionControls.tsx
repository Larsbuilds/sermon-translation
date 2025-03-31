'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Users, Settings, LogOut } from 'lucide-react';

interface SessionControlsProps {
  isSpeaking: boolean;
  setIsSpeaking: (speaking: boolean) => void;
  onShowParticipants: () => void;
  onShowSettings: () => void;
  onLeaveSession: () => void;
}

export function SessionControls({
  isSpeaking,
  setIsSpeaking,
  onShowParticipants,
  onShowSettings,
  onLeaveSession,
}: SessionControlsProps) {
  return (
    <div className="flex items-center space-x-2">
      <Button
        variant={isSpeaking ? 'default' : 'outline'}
        size="icon"
        onClick={() => setIsSpeaking(!isSpeaking)}
        className="w-10 h-10"
      >
        {isSpeaking ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={onShowParticipants}
        className="w-10 h-10"
      >
        <Users className="h-5 w-5" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={onShowSettings}
        className="w-10 h-10"
      >
        <Settings className="h-5 w-5" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={onLeaveSession}
        className="w-10 h-10"
      >
        <LogOut className="h-5 w-5" />
      </Button>
    </div>
  );
} 