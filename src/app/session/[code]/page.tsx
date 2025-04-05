'use client';

import React from 'react';
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
import { WebRTCExample } from '@/app/components/webrtc/WebRTCExample';

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
  const [deviceId] = React.useState(() => `device-${Math.random().toString(36).substring(7)}`);
  const [isMain] = React.useState(() => currentSession?.speaker === 'You');

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
      <h1 className="text-3xl font-bold mb-8">{currentSession.name}</h1>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Connection Details</h2>
        <div className="space-y-2">
          <p><span className="font-medium">Session Code:</span> {code}</p>
          <p><span className="font-medium">Device ID:</span> {deviceId}</p>
          <p><span className="font-medium">Role:</span> {isMain ? 'Speaker' : 'Listener'}</p>
        </div>
      </div>

      <WebRTCExample
        sessionId={code as string}
        deviceId={deviceId}
        isMain={isMain}
        signalingUrl={process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:3002'}
      />

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