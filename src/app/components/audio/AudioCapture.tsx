'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { setupAudioAnalyzer, getAudioData, cleanupAudioAnalyzer, AudioAnalyzerResult } from '../../../lib/audio/analyzer';
import { calculateAudioQuality } from '../../../lib/audio/quality';
import { AudioBuffer } from '../../../lib/audio/buffer';
import { AudioQualityMetrics } from '../../../types/audio';
import AudioVisualizer from './AudioVisualizer';
import { useSession } from '../../contexts/SessionContext';

interface AudioCaptureProps {
  onAudioData?: (frequencyData: Uint8Array, timeData: Uint8Array) => void;
  onBufferReady?: (buffer: Float32Array) => void;
  onQualityUpdate?: (metrics: AudioQualityMetrics) => void;
  onError?: (error: Error) => void;
  isActive?: boolean;
  isSpeaker?: boolean;
  sessionId?: string;
}

export default function AudioCapture({
  onAudioData,
  onBufferReady,
  onQualityUpdate,
  onError,
  isActive = false,
  isSpeaker = false,
  sessionId,
}: AudioCaptureProps) {
  const { endSession, sessions } = useSession();
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [audioQuality, setAudioQuality] = useState<AudioQualityMetrics | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const animationFrameRef = useRef<number>();
  const chunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const currentSession = sessionId ? sessions.find(s => s.id === sessionId) : null;
  const participants = currentSession?.listeners || 0;

  const handleQuitCall = useCallback(() => {
    if (sessionId) {
      endSession();
    }
  }, [sessionId, endSession]);

  const cleanupAudioResources = useCallback(() => {
    // Stop and cleanup MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }

    // Cancel animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Close AudioContext if it exists and is not already closed
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch (err) {
        console.warn('Error closing AudioContext:', err);
      }
    }

    // Reset refs
    mediaRecorderRef.current = null;
    audioContextRef.current = null;
    analyzerRef.current = null;
    mediaStreamRef.current = null;
    chunksRef.current = [];

    // Reset state
    setIsRecording(false);
    setIsConnected(false);
    setIsMuted(false);
    setAudioQuality(null);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      // Cleanup any existing resources first
      cleanupAudioResources();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      // Set up audio context and analyzer
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyzer = audioContext.createAnalyser();
      analyzer.fftSize = 2048;
      analyzerRef.current = analyzer;
      source.connect(analyzer);

      // Set up audio buffer
      audioBufferRef.current = new AudioBuffer();

      // Handle data available event
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      // Start recording
      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setIsConnected(true);

      // Start animation loop for visualization
      const animate = () => {
        if (analyzer && isRecording) {
          const frequencyData = new Uint8Array(analyzer.frequencyBinCount);
          const timeData = new Uint8Array(analyzer.frequencyBinCount);
          analyzer.getByteFrequencyData(frequencyData);
          analyzer.getByteTimeDomainData(timeData);

          // Update audio quality metrics
          const quality = calculateAudioQuality(frequencyData, timeData);
          setAudioQuality(quality);
          onQualityUpdate?.(quality);

          // Send audio data to parent
          onAudioData?.(frequencyData, timeData);

          // Add to buffer
          audioBufferRef.current?.addData(timeData);
          if (audioBufferRef.current?.isReady()) {
            onBufferReady?.(audioBufferRef.current.getData());
          }
        }
        animationFrameRef.current = requestAnimationFrame(animate);
      };

      animate();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to start recording');
      setError(error);
      onError?.(error);
      cleanupAudioResources();
    }
  }, [onAudioData, onBufferReady, onQualityUpdate, onError, cleanupAudioResources]);

  const stopRecording = useCallback(() => {
    cleanupAudioResources();
  }, [cleanupAudioResources]);

  const toggleMute = useCallback(() => {
    if (mediaStreamRef.current) {
      const audioTrack = mediaStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        
        // Stop or resume the animation frame based on mute state
        if (!audioTrack.enabled && animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        } else if (audioTrack.enabled && isRecording && analyzerRef.current) {
          const animate = () => {
            if (analyzerRef.current && isRecording) {
              const frequencyData = new Uint8Array(analyzerRef.current.frequencyBinCount);
              const timeData = new Uint8Array(analyzerRef.current.frequencyBinCount);
              analyzerRef.current.getByteFrequencyData(frequencyData);
              analyzerRef.current.getByteTimeDomainData(timeData);

              // Update audio quality metrics
              const quality = calculateAudioQuality(frequencyData, timeData);
              setAudioQuality(quality);
              onQualityUpdate?.(quality);

              // Send audio data to parent
              onAudioData?.(frequencyData, timeData);

              // Add to buffer
              audioBufferRef.current?.addData(timeData);
              if (audioBufferRef.current?.isReady()) {
                onBufferReady?.(audioBufferRef.current.getData());
              }
            }
            animationFrameRef.current = requestAnimationFrame(animate);
          };
          animate();
        }
      }
    }
  }, [isRecording, onAudioData, onBufferReady, onQualityUpdate]);

  useEffect(() => {
    if (isActive) {
      startRecording();
    } else {
      stopRecording();
    }

    return () => {
      stopRecording();
    };
  }, [isActive, startRecording, stopRecording]);

  return (
    <div className="space-y-6">
      {/* Session Status and Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
          <span className="text-sm font-medium text-gray-700">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <div className="flex items-center space-x-4">
          {/* Mute Button */}
          <button
            onClick={toggleMute}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg transition-colors ${
              isMuted
                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isMuted ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                />
              )}
            </svg>
            <span className="text-sm font-medium">
              {isMuted ? 'Unmute' : 'Mute'}
            </span>
          </button>

          {/* Recording Indicator */}
          {isRecording && (
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-medium text-red-600">Recording</span>
            </div>
          )}

          {/* Quit Call Button (Speaker Only) */}
          {isSpeaker && isRecording && (
            <button
              onClick={handleQuitCall}
              className="flex items-center space-x-2 px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span className="text-sm font-medium">Quit Call</span>
            </button>
          )}
        </div>
      </div>

      {/* Session Info (Speaker Only) */}
      {isSpeaker && currentSession && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-900">Your Session</h3>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-sm text-gray-600">Active</span>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span>{participants} {participants === 1 ? 'Participant' : 'Participants'}</span>
          </div>
        </div>
      )}

      {/* Audio Visualizer */}
      <div className="bg-gray-50 rounded-lg p-4">
        <AudioVisualizer isActive={isRecording} />
      </div>

      {/* Audio Quality Metrics */}
      {audioQuality && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="text-sm text-gray-500 mb-1">Signal Strength</div>
            <div className="text-2xl font-semibold text-gray-900">
              {Math.round(audioQuality.signalStrength * 100)}%
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="text-sm text-gray-500 mb-1">Noise Level</div>
            <div className="text-2xl font-semibold text-gray-900">
              {Math.round(audioQuality.noiseLevel * 100)}%
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="text-sm text-gray-500 mb-1">Clarity</div>
            <div className="text-2xl font-semibold text-gray-900">
              {Math.round(audioQuality.clarity * 100)}%
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center text-red-600">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error.message}</span>
          </div>
        </div>
      )}
    </div>
  );
} 