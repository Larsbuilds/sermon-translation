'use client';

import React, { useState } from 'react';
import { useSession } from '../../contexts/SessionContext';
import { useRouter } from 'next/navigation';

interface SessionCodeDisplayProps {
  isSpeaker: boolean;
  sessionCode?: string;
}

export default function SessionCodeDisplay({ isSpeaker, sessionCode }: SessionCodeDisplayProps) {
  const { joinSession } = useSession();
  const router = useRouter();
  const [inputCode, setInputCode] = useState('');
  const [error, setError] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const handleJoinSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) {
      setError('Please enter a session code');
      return;
    }

    try {
      setIsJoining(true);
      setError('');
      await joinSession(inputCode);
      router.push(`/session/${inputCode}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to join session');
    } finally {
      setIsJoining(false);
    }
  };

  if (isSpeaker && sessionCode) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Your Session Code</h3>
        <div className="flex items-center space-x-2">
          <code className="text-2xl font-mono bg-gray-100 px-4 py-2 rounded-lg">
            {sessionCode}
          </code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(sessionCode);
              // You could add a toast notification here
            }}
            className="text-blue-600 hover:text-blue-800"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
          </button>
        </div>
        <p className="mt-2 text-sm text-gray-600">
          Share this code with your listeners so they can join your session
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Join a Session</h3>
      <form onSubmit={handleJoinSession} className="space-y-4">
        <div>
          <label htmlFor="sessionCode" className="block text-sm font-medium text-gray-700 mb-1">
            Enter Session Code
          </label>
          <input
            type="text"
            id="sessionCode"
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value.toUpperCase())}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter 6-digit code"
            maxLength={6}
            required
          />
        </div>
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
        <button
          type="submit"
          disabled={isJoining}
          className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {isJoining ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Joining...
            </>
          ) : (
            'Join Session'
          )}
        </button>
      </form>
    </div>
  );
} 