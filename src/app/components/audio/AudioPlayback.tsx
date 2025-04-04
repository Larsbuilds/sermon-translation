'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import AudioVisualizer from './AudioVisualizer';
import { websocketConfig } from '../../../config/websocket';

interface AudioPlaybackProps {
  sessionId: string;
}

export default function AudioPlayback({ sessionId }: AudioPlaybackProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [frequencyData, setFrequencyData] = useState<Uint8Array | undefined>();
  const [timeData, setTimeData] = useState<Uint8Array | undefined>();
  const audioContextRef = useRef<AudioContext | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const audioQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const visualizerDataRef = useRef<{ frequencyData: Uint8Array; timeData: Uint8Array } | null>(null);

  const cleanupAudioResources = () => {
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
    audioContextRef.current = null;
    websocketRef.current = null;
    audioQueueRef.current = [];

    // Reset state
    setIsConnected(false);
    setIsPlaying(false);
    isPlayingRef.current = false;
    setFrequencyData(undefined);
    setTimeData(undefined);
  };

  const startPlayback = useCallback(async () => {
    try {
      if (!sessionId) {
        throw new Error('Session ID is required');
      }

      // Cleanup any existing resources first
      cleanupAudioResources();

      // Create audio context
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      // Create WebSocket connection
      console.log('Connecting to WebSocket server...');
      const ws = new WebSocket(`${websocketConfig.websocketUrl}?sessionId=${sessionId}`);
      websocketRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connection established');
        setIsConnected(true);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };

      ws.onclose = () => {
        console.log('WebSocket connection closed');
        setIsConnected(false);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Received audio data:', {
            type: data.type,
            frequencyDataLength: data.frequencyData?.length,
            timeDataLength: data.timeData?.length
          });

          if (data.type === 'audio' && data.frequencyData && data.timeData) {
            // Update visualizer data
            const newFrequencyData = new Uint8Array(data.frequencyData);
            const newTimeData = new Uint8Array(data.timeData);
            setFrequencyData(newFrequencyData);
            setTimeData(newTimeData);
            visualizerDataRef.current = { frequencyData: newFrequencyData, timeData: newTimeData };

            // Add to audio queue
            const audioData = new Float32Array(data.timeData);
            audioQueueRef.current.push(audioData);
            console.log('Audio queue length:', audioQueueRef.current.length);

            // Start playback if not already playing
            if (!isPlaying) {
              playNextInQueue();
            }
          }
        } catch (error) {
          console.error('Error processing audio data:', error);
        }
      };

      // Start animation loop for visualization
      const animate = () => {
        if (visualizerDataRef.current) {
          // Update visualizer
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              // Draw visualization
              ctx.fillStyle = 'rgb(200, 200, 200)';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.lineWidth = 1;
              ctx.strokeStyle = 'rgb(0, 0, 0)';
              ctx.beginPath();
              const sliceWidth = canvas.width / visualizerDataRef.current.timeData.length;
              let x = 0;
              for (let i = 0; i < visualizerDataRef.current.timeData.length; i++) {
                const v = visualizerDataRef.current.timeData[i] / 128.0;
                const y = v * canvas.height / 2;
                if (i === 0) {
                  ctx.moveTo(x, y);
                } else {
                  ctx.lineTo(x, y);
                }
                x += sliceWidth;
              }
              ctx.lineTo(canvas.width, canvas.height / 2);
              ctx.stroke();
            }
          }
        }
        animationFrameRef.current = requestAnimationFrame(animate);
      };

      animate();
      console.log('Playback started');
    } catch (error) {
      console.error('Error starting playback:', error);
      setIsConnected(false);
    }
  }, [sessionId, isPlaying]);

  const playNextInQueue = async () => {
    if (!audioContextRef.current || audioQueueRef.current.length === 0) return;

    try {
      const audioData = audioQueueRef.current.shift()!;
      const buffer = audioContextRef.current.createBuffer(1, audioData.length, audioContextRef.current.sampleRate);
      buffer.copyToChannel(audioData, 0);
      
      const source = audioContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContextRef.current.destination);
      
      source.onended = () => {
        if (audioQueueRef.current.length > 0) {
          playNextInQueue();
        } else {
          isPlayingRef.current = false;
          setIsPlaying(false);
        }
      };

      source.start();
      isPlayingRef.current = true;
      setIsPlaying(true);
    } catch (err) {
      console.error('Error playing audio:', err);
      isPlayingRef.current = false;
      setIsPlaying(false);
    }
  };

  const handlePlayClick = async () => {
    if (!audioContextRef.current) {
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      
      // Resume the audio context (required for autoplay)
      await audioContext.resume();
    }
    
    if (audioQueueRef.current.length > 0) {
      playNextInQueue();
    }
  };

  useEffect(() => {
    if (sessionId) {
      startPlayback();
    }

    return () => {
      cleanupAudioResources();
    };
  }, [sessionId, startPlayback]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-sm text-gray-600">
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      {!isPlaying && audioQueueRef.current.length > 0 && (
        <button
          onClick={handlePlayClick}
          className="px-4 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600"
        >
          Play Audio
        </button>
      )}
      <AudioVisualizer
        isActive={isConnected}
        frequencyData={frequencyData}
        timeData={timeData}
      />
    </div>
  );
} 