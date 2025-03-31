'use client';

import React, { useState } from 'react';
import AudioCapture from './components/audio/AudioCapture';
import DeviceManager from './components/device/DeviceManager';
import { TranslationOrchestrationClient } from '../lib/orchestration/client';
import { AudioQualityMetrics } from '../types/audio';

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

  const handleAudioData = (frequencyData: Uint8Array, timeData: Uint8Array) => {
    // Handle audio data processing
    console.log('Received audio data:', { frequencyData, timeData });
  };

  const handleBufferReady = (buffer: Float32Array) => {
    // Handle buffer ready for translation
    console.log('Buffer ready for translation:', buffer);
  };

  const handleQualityUpdate = (metrics: AudioQualityMetrics) => {
    // Handle quality metrics update
    console.log('Audio quality metrics:', metrics);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Sermon Translation System</h1>
        <p className="text-gray-600 mb-8">Real-time translation for sermons and presentations</p>
        
        {/* Session Setup */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-gray-100">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">Session Setup</h2>
          <div className="flex flex-col md:flex-row gap-6 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Session ID
              </label>
              <input
                type="text"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option value="main">Main Device (Speaker)</option>
                <option value="listener">Listener Device</option>
              </select>
            </div>
            <button
              onClick={handleStartSession}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 transform hover:scale-105 shadow-md"
            >
              Start Session
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg mb-8">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Device Manager */}
        {sessionId && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-gray-100">
            <DeviceManager
              isMain={isMain}
              sessionId={sessionId}
              onConnected={handleDeviceConnected}
              onDisconnected={handleDeviceDisconnected}
              onError={handleError}
            />
          </div>
        )}

        {/* Audio Capture */}
        {orchestrationClient && (
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <AudioCapture
              onAudioData={handleAudioData}
              onBufferReady={handleBufferReady}
              onQualityUpdate={handleQualityUpdate}
              onError={handleError}
            />
          </div>
        )}
      </div>
    </main>
  );
} 