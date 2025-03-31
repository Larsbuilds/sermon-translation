'use client';

import React, { useEffect, useRef, useState } from 'react';

interface AudioVisualizerProps {
  isActive: boolean;
}

export default function AudioVisualizer({ isActive }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (isActive) {
      const setupAudio = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const context = new AudioContext();
          const source = context.createMediaStreamSource(stream);
          const analyserNode = context.createAnalyser();
          analyserNode.fftSize = 2048;
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
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
      if (audioContext) {
        audioContext.close();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }

    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
      if (audioContext) {
        audioContext.close();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isActive]);

  useEffect(() => {
    if (!isActive || !analyser || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!isActive || !analyser) return;

      animationFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      ctx.fillStyle = 'rgb(200, 200, 200)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgb(0, 0, 0)';
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
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
    };

    draw();
  }, [isActive, analyser]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={600}
        height={200}
        className="w-full h-48 bg-gray-100 rounded-lg"
      />
      {isActive && (
        <div className="absolute top-2 right-2 flex items-center space-x-2 bg-red-100 px-3 py-1 rounded-full">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-sm font-medium text-red-700">Recording</span>
        </div>
      )}
    </div>
  );
} 