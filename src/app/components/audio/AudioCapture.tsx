'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { setupAudioAnalyzer, getAudioData, cleanupAudioAnalyzer, AudioAnalyzerResult } from '../../../lib/audio/analyzer';
import { calculateAudioQuality } from '../../../lib/audio/quality';
import { AudioBuffer } from '../../../lib/audio/buffer';
import { AudioQualityMetrics } from '../../../types/audio';
import AudioVisualizer from './AudioVisualizer';
import { useSession } from '../../contexts/SessionContext';
import { toast } from 'sonner';

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
  const [isInitializing, setIsInitializing] = useState(false);
  const [frequencyData, setFrequencyData] = useState<Uint8Array | null>(null);
  const [timeData, setTimeData] = useState<Uint8Array | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const animationFrameRef = useRef<number>();
  const chunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const isMountedRef = useRef(true);

  const currentSession = sessionId ? sessions.find(s => s.id === sessionId) : null;
  const participants = currentSession?.listenerCount || 0;

  // Add cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      cleanupAudioResources();
    };
  }, []);

  // Add a new effect to handle initial microphone permission request
  useEffect(() => {
    const requestMicrophonePermission = async () => {
      if (!isMountedRef.current) return;
      
      try {
        setIsInitializing(true);
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 44100,
            channelCount: 1
          } 
        });
        
        if (!isMountedRef.current) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        // Store the stream for later use
        mediaStreamRef.current = stream;
        toast.success('Microphone access granted');
      } catch (err) {
        if (!isMountedRef.current) return;
        
        const error = err instanceof Error ? err : new Error('Failed to access microphone');
        if (error.name === 'NotAllowedError') {
          toast.error('Microphone access denied. Please allow microphone access in your browser settings.');
        } else if (error.name === 'NotFoundError') {
          toast.error('No microphone found. Please connect a microphone and try again.');
        } else {
          toast.error('Failed to access microphone: ' + error.message);
        }
        setError(error);
      } finally {
        if (isMountedRef.current) {
          setIsInitializing(false);
        }
      }
    };

    // Request microphone permission immediately when component mounts
    requestMicrophonePermission();
  }, []); // Empty dependency array means this runs once on mount

  // Effect to handle audio recording state
  useEffect(() => {
    if (!isMountedRef.current) return;

    if (isActive) {
      startRecording().catch(err => {
        if (!isMountedRef.current) return;
        console.error('Failed to start recording:', err);
        onError?.(err);
      });
    } else {
      cleanupAudioResources();
    }

    return () => {
      if (!isMountedRef.current) return;
      cleanupAudioResources();
    };
  }, [isActive]);

  const handleQuitCall = useCallback(() => {
    if (sessionId) {
      endSession();
    }
  }, [sessionId, endSession]);

  const cleanupAudioResources = useCallback(() => {
    if (!isMountedRef.current) return;

    // Stop and cleanup MediaRecorder
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    mediaRecorderRef.current = null;

    // Cleanup AudioContext
    if (audioContextRef.current?.state !== 'closed') {
      audioContextRef.current?.close();
    }
    audioContextRef.current = null;

    // Cleanup analyzer
    analyzerRef.current = null;

    // Cleanup audio buffer
    audioBufferRef.current = null;

    // Cleanup media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    // Cancel animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
    }

    // Reset states
    setIsRecording(false);
    setIsConnected(false);
    setFrequencyData(null);
    setTimeData(null);
    setError(null);
  }, []);

  const handleAudioQuality = (quality: AudioQualityMetrics) => {
    setAudioQuality(quality);
    onQualityUpdate?.(quality);

    // Check for poor audio quality conditions
    if (quality.signalStrength < 0.3) {
      toast.warning('Audio signal is weak. Please check your microphone.');
    }
    if (quality.noiseLevel > 0.7) {
      toast.warning('High background noise detected. Please move to a quieter location.');
    }
    if (quality.clarity < 0.4) {
      toast.warning('Audio clarity is low. Please speak more clearly or check your microphone.');
    }
  };

  const startRecording = useCallback(async () => {
    if (!isMountedRef.current) return;

    try {
      setIsInitializing(true);
      // Cleanup any existing resources first
      cleanupAudioResources();

      // Use existing stream if available, otherwise request new one
      let stream = mediaStreamRef.current;
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 44100,
            channelCount: 1
          } 
        });
        mediaStreamRef.current = stream;
      }
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      mediaRecorderRef.current = mediaRecorder;

      // Set up audio context and analyzer
      const audioContext = new AudioContext({
        sampleRate: 44100,
        latencyHint: 'interactive'
      });
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyzer = audioContext.createAnalyser();
      analyzer.fftSize = 2048;
      analyzer.smoothingTimeConstant = 0.8;
      analyzer.minDecibels = -90;
      analyzer.maxDecibels = -10;
      analyzerRef.current = analyzer;
      source.connect(analyzer);

      // Set up audio buffer
      audioBufferRef.current = new AudioBuffer();

      // Handle data available event
      mediaRecorder.ondataavailable = (event) => {
        if (!isMountedRef.current) return;
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      // Handle errors from the media stream
      stream.getAudioTracks().forEach(track => {
        track.onended = () => {
          if (!isMountedRef.current) return;
          setIsConnected(false);
          toast.error('Audio input device disconnected');
        };
        track.onmute = () => {
          if (!isMountedRef.current) return;
          setIsMuted(true);
          toast.warning('Microphone muted');
        };
        track.onunmute = () => {
          if (!isMountedRef.current) return;
          setIsMuted(false);
          toast.success('Microphone unmuted');
        };
      });

      // Start recording
      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setIsConnected(true);
      toast.success('Recording started');

      // Start animation loop for visualization
      const animate = () => {
        if (!isMountedRef.current) return;
        if (analyzer && isRecording) {
          const freqData = new Uint8Array(analyzer.frequencyBinCount);
          const timeData = new Uint8Array(analyzer.frequencyBinCount);
          analyzer.getByteFrequencyData(freqData);
          analyzer.getByteTimeDomainData(timeData);

          // Update audio data state
          setFrequencyData(freqData);
          setTimeData(timeData);

          // Update audio quality metrics
          const quality = calculateAudioQuality(freqData, timeData);
          handleAudioQuality(quality);

          // Send audio data to parent
          onAudioData?.(freqData, timeData);

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
      if (!isMountedRef.current) return;
      
      const error = err instanceof Error ? err : new Error('Failed to start recording');
      setError(error);
      onError?.(error);
      cleanupAudioResources();
      
      // Show specific error messages based on the error type
      if (error.name === 'NotAllowedError') {
        toast.error('Microphone access denied. Please allow microphone access in your browser settings.');
      } else if (error.name === 'NotFoundError') {
        toast.error('No microphone found. Please connect a microphone and try again.');
      } else if (error.name === 'NotReadableError') {
        toast.error('Microphone is in use by another application. Please close other applications using the microphone.');
      } else {
        toast.error('Failed to start recording: ' + error.message);
      }
    } finally {
      if (isMountedRef.current) {
        setIsInitializing(false);
      }
    }
  }, [cleanupAudioResources, onAudioData, onBufferReady, onError, onQualityUpdate]);

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
              handleAudioQuality(quality);

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

  return (
    <div className="space-y-6">
      {/* Session Status and Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full ${
            isInitializing ? 'bg-yellow-500 animate-pulse' :
            isConnected ? 'bg-green-500' : 'bg-gray-400'
          }`} />
          <span className="text-sm font-medium text-gray-700">
            {isInitializing ? 'Initializing...' :
             isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <div className="flex items-center space-x-4">
          {/* Mute Button */}
          <button
            onClick={toggleMute}
            disabled={isInitializing || !isConnected}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg transition-colors relative group ${
              isInitializing ? 'bg-gray-100 text-gray-400 cursor-not-allowed' :
              isMuted
                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title={isMuted ? "Click to unmute your microphone" : "Click to mute your microphone"}
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
            <div className="flex items-center space-x-2 bg-red-50 px-3 py-1.5 rounded-lg shadow-sm">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-medium text-red-700">Recording</span>
            </div>
          )}

          {/* Quit Call Button (Speaker Only) */}
          {isSpeaker && isRecording && (
            <button
              onClick={handleQuitCall}
              className="flex items-center space-x-2 px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors relative group"
              title="End the current session"
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
        <AudioVisualizer 
          isActive={isRecording} 
          frequencyData={frequencyData || undefined}
          timeData={timeData || undefined}
        />
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