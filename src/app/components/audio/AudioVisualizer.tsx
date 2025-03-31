'use client';

import React, { useEffect, useRef, useState } from 'react';

interface AudioVisualizerProps {
  isActive: boolean;
  frequencyData?: Uint8Array;
  timeData?: Uint8Array;
}

export default function AudioVisualizer({ isActive, frequencyData, timeData }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  const cleanup = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
    }
    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close();
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  };

  useEffect(() => {
    if (isActive) {
      const setupAudio = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              sampleRate: 44100,
              channelCount: 1
            } 
          });
          const context = new AudioContext({
            sampleRate: 44100,
            latencyHint: 'interactive'
          });
          const source = context.createMediaStreamSource(stream);
          const analyserNode = context.createAnalyser();
          analyserNode.fftSize = 2048;
          analyserNode.smoothingTimeConstant = 0.8;
          analyserNode.minDecibels = -90;
          analyserNode.maxDecibels = -10;
          source.connect(analyserNode);

          setAudioContext(context);
          setAnalyser(analyserNode);
          setMediaStream(stream);
        } catch (error) {
          console.error('Error accessing microphone:', error);
        }
      };

      setupAudio();
    } else {
      cleanup();
    }

    return cleanup;
  }, [isActive]);

  useEffect(() => {
    if (!isActive || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      if (!isActive) return;

      animationFrameRef.current = requestAnimationFrame(draw);
      
      // Clear canvas
      ctx.fillStyle = 'rgb(240, 240, 240)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw time domain waveform
      if (timeData) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgb(59, 130, 246)';
        ctx.beginPath();

        const sliceWidth = canvas.width / timeData.length;
        let x = 0;

        for (let i = 0; i < timeData.length; i++) {
          const v = timeData[i] / 128.0;
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

      // Draw frequency spectrum
      if (frequencyData) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgb(16, 185, 129)';
        ctx.beginPath();

        const barWidth = (canvas.width / frequencyData.length) * 2.5;
        let barX = 0;

        for (let i = 0; i < frequencyData.length; i++) {
          const barHeight = (frequencyData[i] / 255) * canvas.height;
          ctx.fillStyle = `rgb(16, 185, 129, ${barHeight / canvas.height})`;
          ctx.fillRect(barX, canvas.height - barHeight, barWidth, barHeight);
          barX += barWidth + 1;
        }
      }
    };

    draw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isActive, frequencyData, timeData]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={600}
        height={200}
        className="w-full h-48 bg-gray-100 rounded-lg shadow-sm"
      />
      {isActive && (
        <div className="absolute top-2 right-2 flex items-center space-x-2 bg-red-50 px-3 py-1.5 rounded-lg shadow-sm">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-sm font-medium text-red-700">Recording</span>
        </div>
      )}
      <div className="absolute bottom-2 left-2 text-xs text-gray-500">
        Blue: Waveform | Green: Frequency Spectrum
      </div>
    </div>
  );
} 