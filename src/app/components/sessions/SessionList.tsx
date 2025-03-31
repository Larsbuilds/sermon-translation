'use client';

import React, { useState } from 'react';

interface Session {
  id: string;
  name: string;
  speaker: string;
  status: 'active' | 'ended';
  listenerCount: number;
  createdAt: Date;
}

interface SessionListProps {
  sessions: Session[];
  onJoinSession: (sessionId: string) => void;
  onStartSession: () => void;
  currentSessionId?: string;
}

export function SessionList({
  sessions,
  onJoinSession,
  onStartSession,
  currentSessionId,
}: SessionListProps) {
  const [error, setError] = useState<string | null>(null);

  const handleJoinSession = async (sessionId: string) => {
    try {
      setError(null);
      await onJoinSession(sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join session');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Active Sessions</h2>
        <button
          onClick={onStartSession}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Session
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        {sessions.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            <p className="text-gray-500">No active sessions. Start a new session to begin.</p>
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className={`p-4 rounded-lg border transition-colors ${
                currentSessionId === session.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h3 className="text-lg font-semibold text-gray-800">{session.name}</h3>
                    {session.status === 'ended' && (
                      <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">
                        Ended
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-2">Speaker: {session.speaker}</p>
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span className="flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      {session.listenerCount} {session.listenerCount === 1 ? 'Participant' : 'Participants'}
                    </span>
                    <span className="flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Started {session.createdAt.toLocaleTimeString()}
                    </span>
                  </div>
                </div>
                {currentSessionId !== session.id && session.status === 'active' && (
                  <button
                    onClick={() => handleJoinSession(session.id)}
                    className="ml-4 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium flex items-center"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Join
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
} 