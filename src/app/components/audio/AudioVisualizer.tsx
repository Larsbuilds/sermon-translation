'use client';

import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  frequencyData: Uint8Array;
  timeData: Uint8Array;
  width?: number;
  height?: number;
}

export default function AudioVisualizer({
  frequencyData,
  timeData,
  width = 300,
  height = 150
}: AudioVisualizerProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      // Clear canvas
      ctx.fillStyle = 'rgb(200, 200, 200)';
      ctx.fillRect(0, 0, width, height);

      // Draw frequency data
      const barWidth = (width / frequencyData.length) * 2.5;
      let barHeight;
      let x = 0;

      ctx.fillStyle = 'rgb(50, 50, 50)';
      for (let i = 0; i < frequencyData.length; i++) {
        barHeight = (frequencyData[i] / 255) * height;
        ctx.fillRect(x, height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }

      // Draw time domain data
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgb(0, 0, 0)';
      ctx.beginPath();
      const sliceWidth = width / timeData.length;
      let x2 = 0;

      for (let i = 0; i < timeData.length; i++) {
        const v = timeData[i] / 128.0;
        const y = (v * height) / 2;

        if (i === 0) {
          ctx.moveTo(x2, y);
        } else {
          ctx.lineTo(x2, y);
        }
        x2 += sliceWidth;
      }

      ctx.lineTo(width, height / 2);
      ctx.stroke();

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [frequencyData, timeData, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="border border-gray-300 rounded-lg"
    />
  );
} 