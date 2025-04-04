'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { setupAudioAnalyzer, getAudioData, cleanupAudioAnalyzer, AudioAnalyzerResult } from '../../../lib/audio/analyzer';
import { calculateAudioQuality } from '../../../lib/audio/quality';
import { AudioBuffer } from '../../../lib/audio/buffer';
import { AudioQualityMetrics } from '../../../types/audio';
import AudioVisualizer from './AudioVisualizer';
import { useSession } from '../../contexts/SessionContext';
import { Button } from '../../../components/ui/button';
import { websocketConfig } from '../../../config/websocket';

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
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const animationFrameRef = useRef<number>();
  const chunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);

  const currentSession = sessionId ? sessions.find(s => s.id === sessionId) : null;
  const participants = currentSession?.listenerCount || 0;

  const handleQuitCall = useCallback(() => {
    if (sessionId) {
      endSession();
    }
  }, [sessionId, endSession]);

  const cleanupAudioResources = useCallback(() => {
    // Cancel animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Stop and cleanup MediaRecorder
    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }

    // Close WebSocket connection
    if (websocketRef.current) {
      websocketRef.current.close();
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
    websocketRef.current = null;

    // Reset state
    setIsRecording(false);
    setIsConnected(false);
    setIsMuted(false);
    setAudioQuality(null);
  }, []);

  const requestPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setHasPermission(true);
      mediaStreamRef.current = stream;
      setupAudioContext(stream);
    } catch (error) {
      console.error('Error requesting microphone permission:', error);
    }
  };

  const setupAudioContext = (stream: MediaStream) => {
    audioContextRef.current = new AudioContext();
    const source = audioContextRef.current.createMediaStreamSource(stream);
    analyzerRef.current = audioContextRef.current.createAnalyser();
    analyzerRef.current.fftSize = 2048;
    source.connect(analyzerRef.current);
  };

  const startRecording = async () => {
    try {
      if (!sessionId) {
        throw new Error('Session ID is required');
      }

      // Request microphone permission first
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setHasPermission(true);
      mediaStreamRef.current = stream;

      // Create audio context and analyzer
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyzer = audioContext.createAnalyser();
      analyzer.fftSize = 2048;
      source.connect(analyzer);

      // Create WebSocket connection
      console.log('Connecting to WebSocket server...');
      const ws = new WebSocket(`${websocketConfig.websocketUrl}?sessionId=${sessionId}`);
      websocketRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connection established');
        setIsRecording(true);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsRecording(false);
      };

      ws.onclose = () => {
        console.log('WebSocket connection closed');
        setIsRecording(false);
      };

      // Start recording loop
      const bufferLength = analyzer.frequencyBinCount;
      const frequencyData = new Uint8Array(bufferLength);
      const timeData = new Uint8Array(bufferLength);

      const record = () => {
        if (!isRecording || !websocketRef.current) return;

        analyzer.getByteFrequencyData(frequencyData);
        analyzer.getByteTimeDomainData(timeData);

        if (websocketRef.current.readyState === WebSocket.OPEN) {
          websocketRef.current.send(JSON.stringify({
            type: 'audio',
            frequencyData: Array.from(frequencyData),
            timeData: Array.from(timeData)
          }));
          console.log('Sent audio data:', frequencyData.length, timeData.length);
        }

        requestAnimationFrame(record);
      };

      record();
      console.log('Recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
      setIsRecording(false);
    }
  };

  const stopRecording = useCallback(() => {
    cleanupAudioResources();

    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }
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
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-sm text-gray-600">
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      {error && (
        <div className="text-sm text-red-500">
          {error.message}
        </div>
      )}
      {hasPermission === false && (
        <Button
          onClick={requestPermission}
          className="px-4 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600"
        >
          Allow Microphone Access
        </Button>
      )}
      <AudioVisualizer
        frequencyData={new Uint8Array(0)}
        timeData={new Uint8Array(0)}
        isActive={isRecording}
      />
      {isSpeaker && (
        <div className="flex items-center gap-4">
          <button
            onClick={toggleMute}
            className={`px-4 py-2 rounded-full ${
              isMuted ? 'bg-red-500' : 'bg-green-500'
            } text-white`}
          >
            {isMuted ? 'Unmute' : 'Mute'}
          </button>
          <button
            onClick={handleQuitCall}
            className="px-4 py-2 bg-red-500 text-white rounded-full"
          >
            End Session
          </button>
        </div>
      )}
    </div>
  );
} 