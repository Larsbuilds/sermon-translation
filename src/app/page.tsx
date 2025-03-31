'use client';

import React, { useState } from 'react';
import AudioCapture from './components/audio/AudioCapture';
import DeviceManager from './components/device/DeviceManager';
import { TranslationOrchestrationClient } from '../lib/orchestration/client';

export default function Home() {
  const [isMain, setIsMain] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [orchestrationClient, setOrchestrationClient] = useState<TranslationOrchestrationClient | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleStartSession = () => {
    if (!sessionId) {
      setError('Please enter a session ID');
      return;
    }
    // Generate a random session ID if none provided
    const newSessionId = sessionId || `session-${Math.random().toString(36).substr(2, 9)}`;
    setSessionId(newSessionId);
  };

  const handleDeviceConnected = (client: TranslationOrchestrationClient) => {
    setOrchestrationClient(client);
    setError(null);
  };

  const handleDeviceDisconnected = () => {
    setOrchestrationClient(null);
  };

  const handleError = (error: Error) => {
    setError(error.message);
  };

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Sermon Translation System</h1>
        
        {/* Session Setup */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Session Setup</h2>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Session ID
              </label>
              <input
                type="text"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Enter or generate session ID"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Device Role
              </label>
              <select
                value={isMain ? 'main' : 'listener'}
                onChange={(e) => setIsMain(e.target.value === 'main')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="main">Main Device (Speaker)</option>
                <option value="listener">Listener Device</option>
              </select>
            </div>
            <button
              onClick={handleStartSession}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              Start Session
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-8">
            {error}
          </div>
        )}

        {/* Device Manager */}
        {sessionId && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <DeviceManager
              isMain={isMain}
              sessionId={sessionId}
              onConnected={handleDeviceConnected}
              onDisconnected={handleDeviceDisconnected}
              onError={handleError}
            />
          </div>
        )}

        {/* Audio Controls */}
        {orchestrationClient && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Audio Controls</h2>
            <AudioCapture
              onAudioData={(frequencyData, timeData) => {
                if (orchestrationClient.isMainDevice()) {
                  // Convert the audio data to Float32Array for translation
                  const floatData = new Float32Array(timeData.length);
                  for (let i = 0; i < timeData.length; i++) {
                    floatData[i] = (timeData[i] - 128) / 128.0;
                  }
                  orchestrationClient.sendTranslation(floatData);
                }
              }}
              onError={handleError}
              isActive={orchestrationClient.isMainDevice()}
            />
          </div>
        )}
      </div>
    </main>
  );
} 