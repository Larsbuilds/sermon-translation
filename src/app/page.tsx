'use client';

import { useState } from 'react';
import { useSession } from '@/contexts/SessionContext';
import StartSessionModal from './components/sessions/StartSessionModal';
import SessionCodeDisplay from './components/sessions/SessionCodeDisplay';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { currentSession } = useSession();
  const [showStartModal, setShowStartModal] = useState(false);
  const router = useRouter();

  const handleStartSession = () => {
    setShowStartModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              <h1 className="text-xl font-semibold text-gray-900">Sermon Translation</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Real-time Sermon Translation
            </h2>
            <p className="text-lg text-gray-600">
              Start or join a session to begin translating sermons in real-time.
            </p>
          </div>

          {/* Session Code Display/Join Form */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
            <SessionCodeDisplay isSpeaker={false} />
          </div>

          {/* Start New Session */}
          <div className="text-center">
            <div className="relative mb-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-50 text-gray-500">Or</span>
              </div>
            </div>
            <button
              onClick={handleStartSession}
              className="px-6 py-3 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors flex items-center mx-auto"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Start New Session
            </button>
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