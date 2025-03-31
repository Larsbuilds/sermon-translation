'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from '@/contexts/SessionContext';
import SpeakerView from '@/app/components/session/SpeakerView';
import ClientView from '@/app/components/session/ClientView';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export default function SessionPage() {
  const params = useParams();
  const router = useRouter();
  const { currentSession, joinSession } = useSession();
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionCode = params.code as string;

  useEffect(() => {
    if (sessionCode && !currentSession) {
      handleJoinSession();
    }
  }, [sessionCode]);

  const handleJoinSession = async () => {
    try {
      setIsJoining(true);
      setError(null);
      await joinSession(sessionCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join session');
    } finally {
      setIsJoining(false);
    }
  };

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <Card className="p-6">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold text-red-500">Error</h2>
            <p className="text-muted-foreground">{error}</p>
            <Button onClick={() => router.push('/')}>Return Home</Button>
          </div>
        </Card>
      </div>
    );
  }

  if (isJoining) {
    return (
      <div className="container mx-auto p-4">
        <Card className="p-6">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold">Joining Session...</h2>
            <p className="text-muted-foreground">Please wait while we connect you to the session.</p>
          </div>
        </Card>
      </div>
    );
  }

  if (!currentSession) {
    return (
      <div className="container mx-auto p-4">
        <Card className="p-6">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold">Join Session</h2>
            <p className="text-muted-foreground">Click the button below to join the session.</p>
            <Button onClick={handleJoinSession}>Join Session</Button>
          </div>
        </Card>
      </div>
    );
  }

  // Determine if the current user is the speaker
  const isSpeaker = currentSession.speaker === 'You';

  return (
    <div className="min-h-screen bg-background">
      {isSpeaker ? (
        <SpeakerView sessionCode={sessionCode} />
      ) : (
        <ClientView sessionCode={sessionCode} />
      )}
    </div>
  );
} 