'use client';

import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  isActive: boolean;
  frequencyData?: Uint8Array;
  timeData?: Uint8Array;
}

export default function AudioVisualizer({ isActive, frequencyData, timeData }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    if (!isActive || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      if (!isActive) return;

      animationFrameRef.current = requestAnimationFrame(draw);

      ctx.fillStyle = 'rgb(200, 200, 200)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgb(0, 0, 0)';
      ctx.beginPath();

      const bufferLength = timeData?.length || 0;
      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = (timeData?.[i] || 0) / 128.0;
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

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isActive, timeData]);

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