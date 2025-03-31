'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/app/contexts/SessionContext';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { SessionStatus } from '@/app/components/session/SessionStatus';
import { SessionControls } from '@/app/components/session/SessionControls';
import { ParticipantsList } from '@/app/components/session/ParticipantsList';
import { SessionSettings } from '@/app/components/session/SessionSettings';
import { SessionTimeoutWarning } from '@/app/components/session/SessionTimeoutWarning';
import { ConnectionStatus } from '@/app/components/session/ConnectionStatus';
import { LoadingState } from '@/app/components/session/LoadingState';

export default function SessionPage() {
  const { code } = useParams();
  const {
    currentSession,
    isConnected,
    isSpeaking,
    setIsSpeaking,
    participants,
    duration,
    timeRemaining,
    onExtendSession,
    onEndSession,
    isLoading,
    error,
    joinSession,
    leaveSession,
    onRemoveParticipant
  } = useSession();
  const [showParticipants, setShowParticipants] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (code && typeof code === 'string' && !currentSession) {
      joinSession(code).catch((error) => {
        toast.error(error.message || 'Failed to join session');
      });
    }
  }, [code, currentSession, joinSession]);

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  if (isLoading) {
    return <LoadingState />;
  }

  if (!currentSession) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Session Not Found</h1>
          <p className="text-gray-600">The session you're looking for doesn't exist or has ended.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2">
          <SessionStatus
            session={currentSession}
            duration={duration}
            timeRemaining={timeRemaining}
            onExtendSession={onExtendSession}
            onEndSession={onEndSession}
          />
          <SessionControls
            isSpeaking={isSpeaking}
            setIsSpeaking={setIsSpeaking}
            onShowParticipants={() => setShowParticipants(true)}
            onShowSettings={() => setShowSettings(true)}
            onLeaveSession={leaveSession}
          />
          <ConnectionStatus isConnected={isConnected} />
        </div>
        <div className="md:col-span-1">
          <ParticipantsList
            participants={participants}
            onRemoveParticipant={onRemoveParticipant}
            isOpen={showParticipants}
            onClose={() => setShowParticipants(false)}
          />
          <SessionSettings
            session={currentSession}
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
          />
          {currentSession.autoEnd && timeRemaining < 300 && (
            <SessionTimeoutWarning
              timeRemaining={timeRemaining}
              onExtendSession={onExtendSession}
            />
          )}
        </div>
      </div>
    </div>
  );
} 