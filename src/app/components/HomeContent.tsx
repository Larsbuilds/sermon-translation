'use client';

import { useState } from 'react';
import { useSession } from '../contexts/SessionContext';
import StartSessionModal from './sessions/StartSessionModal';
import SessionCodeDisplay from './sessions/SessionCodeDisplay';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function HomeContent() {
  const { currentSession } = useSession();
  const [showStartModal, setShowStartModal] = useState(false);
  const router = useRouter();

  const handleStartSession = () => {
    setShowStartModal(true);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              <h1 className="text-xl font-semibold">Sermon Translation</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">
              Real-time Sermon Translation
            </h2>
            <p className="text-lg text-muted-foreground">
              Start or join a session to begin translating sermons in real-time.
            </p>
          </div>

          {/* Session Code Display/Join Form */}
          <Card className="p-6 mb-8">
            <SessionCodeDisplay isSpeaker={false} />
          </Card>

          {/* Start Session Button */}
          <div className="text-center">
            <Button
              onClick={handleStartSession}
              size="lg"
              className="w-full sm:w-auto"
            >
              Start New Session
            </Button>
          </div>
        </div>
      </main>

      {/* Start Session Modal */}
      <StartSessionModal
        isOpen={showStartModal}
        onClose={() => setShowStartModal(false)}
      />
    </div>
  );
} 