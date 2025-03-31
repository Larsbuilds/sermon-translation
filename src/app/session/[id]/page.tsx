'use client';

import { useEffect, useState } from 'react';
import { useSession } from '../../contexts/SessionContext';
import AudioCapture from '../../components/audio/AudioCapture';
import SessionCodeDisplay from '../../components/sessions/SessionCodeDisplay';
import { useRouter } from 'next/navigation';

interface PageProps {
  params: {
    id: string;
  };
}

export default function SessionPage({ params }: PageProps) {
  const router = useRouter();
  const { currentSession, endSession, removeParticipant } = useSession();
  const [isSpeaker, setIsSpeaker] = useState(false);

  useEffect(() => {
    if (!currentSession) {
      router.push('/');
    } else {
      // Check if the current user is the speaker by comparing with the session's speaker name
      setIsSpeaker(currentSession.speaker === currentSession.participants[0]);
    }
  }, [currentSession, router]);

  const handleLeaveSession = () => {
    if (isSpeaker) {
      endSession();
    } else {
      removeParticipant(currentSession!.sessionCode, 'You');
    }
    router.push('/');
  };

  if (!currentSession) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/')}
                className="text-gray-600 hover:text-gray-900"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <h1 className="text-xl font-semibold text-gray-900">{currentSession.name}</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {currentSession.listeners} {currentSession.listeners === 1 ? 'participant' : 'participants'}
              </span>
              <button
                onClick={handleLeaveSession}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                {isSpeaker ? 'End Session' : 'Leave Session'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content Area */}
          <div className="lg:col-span-2">
            {/* Audio Controls */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Audio Controls</h2>
              <AudioCapture
                isActive={true}
                isSpeaker={isSpeaker}
                onError={(error) => console.error('Audio error:', error)}
                sessionId={currentSession.id}
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Session Code Display */}
            <SessionCodeDisplay
              isSpeaker={isSpeaker}
              sessionCode={currentSession.sessionCode}
            />

            {/* Session Info */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Session Info</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Speaker</h3>
                  <p className="text-sm text-gray-900">{currentSession.speaker}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Started</h3>
                  <p className="text-sm text-gray-900">
                    {currentSession.createdAt.toLocaleString()}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Status</h3>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-sm text-gray-900">Active</span>
                  </div>
                </div>

                {/* Participants List - Only show for speakers */}
                {isSpeaker && currentSession.participants.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Participants</h3>
                    <div className="space-y-2">
                      {currentSession.participants.map((participant, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                          <span className="text-sm text-gray-900">
                            {participant === currentSession.speaker ? `${participant} (Speaker)` : participant}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 