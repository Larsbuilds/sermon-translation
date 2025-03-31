'use client';

import { useState, useEffect } from 'react';
import { useSession } from '@/contexts/SessionContext';
import { useRouter } from 'next/navigation';

interface SessionCodeDisplayProps {
  isSpeaker: boolean;
}

export default function SessionCodeDisplay({ isSpeaker }: SessionCodeDisplayProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const { currentSession, joinSession } = useSession();
  const router = useRouter();

  useEffect(() => {
    // Only attempt to join if we have a valid code
    if (code && code.length === 6) {
      handleJoinSession();
    }
  }, [code]);

  const handleJoinSession = async () => {
    try {
      setError('');
      await joinSession(code);
      router.push(`/session/${code}`);
    } catch (err) {
      console.error('Error joining session:', err);
      setError('Failed to join session. Please check the code and try again.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length === 6) {
      handleJoinSession();
    }
  };

  if (isSpeaker) {
    return (
      <div className="text-center">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Your Session Code</h3>
        <div className="text-3xl font-bold text-blue-600 tracking-wider">
          {currentSession?.id || 'Generating...'}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 mb-4">Join a Session</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="code" className="block text-sm font-medium text-gray-700">
            Enter Session Code
          </label>
          <div className="mt-1">
            <input
              type="text"
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="Enter 6-digit code"
              maxLength={6}
              pattern="[A-Z0-9]{6}"
            />
          </div>
        </div>
        {error && (
          <div className="text-red-600 text-sm">{error}</div>
        )}
        <button
          type="submit"
          disabled={code.length !== 6}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Join Session
        </button>
      </form>
    </div>
  );
} 