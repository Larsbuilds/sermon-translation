'use client';

import React, { useEffect, useRef, useState } from 'react';
import { setupAudioAnalyzer, getAudioData, cleanupAudioAnalyzer, AudioAnalyzerResult } from '../../../lib/audio/analyzer';

interface AudioCaptureProps {
  onAudioData?: (frequencyData: Uint8Array, timeData: Uint8Array) => void;
  onError?: (error: Error) => void;
  isActive?: boolean;
}

export default function AudioCapture({
  onAudioData,
  onError,
  isActive = true
}: AudioCaptureProps): JSX.Element {
  const [isRecording, setIsRecording] = useState(false);
  const analyzerRef = useRef<AudioAnalyzerResult | null>(null);
  const animationFrameRef = useRef<number>();

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      analyzerRef.current = setupAudioAnalyzer(stream);
      setIsRecording(true);
      startAnalysis();
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('Failed to start recording'));
    }
  };

  const stopRecording = () => {
    if (analyzerRef.current) {
      cleanupAudioAnalyzer(analyzerRef.current);
      analyzerRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setIsRecording(false);
  };

  const startAnalysis = () => {
    if (!analyzerRef.current || !isActive) return;

    const { analyser, dataArray } = analyzerRef.current;
    const { frequencyData, timeData } = getAudioData(analyser, dataArray);
    
    onAudioData?.(frequencyData, timeData);
    
    animationFrameRef.current = requestAnimationFrame(startAnalysis);
  };

  useEffect(() => {
    if (isActive && !isRecording) {
      startRecording();
    } else if (!isActive && isRecording) {
      stopRecording();
    }

    return () => {
      stopRecording();
    };
  }, [isActive]);

  return (
    <div className="flex items-center justify-center p-4">
      <button
        onClick={() => isRecording ? stopRecording() : startRecording()}
        className={`px-4 py-2 rounded-lg ${
          isRecording
            ? 'bg-red-500 hover:bg-red-600'
            : 'bg-blue-500 hover:bg-blue-600'
        } text-white transition-colors`}
      >
        {isRecording ? 'Stop Recording' : 'Start Recording'}
      </button>
    </div>
  );
} 