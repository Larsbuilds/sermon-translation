'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { setupAudioAnalyzer, getAudioData, cleanupAudioAnalyzer, AudioAnalyzerResult } from '../../../lib/audio/analyzer';
import { calculateAudioQuality } from '../../../lib/audio/quality';
import { AudioBuffer } from '../../../lib/audio/buffer';
import { AudioQualityMetrics } from '../../../types/audio';
import AudioVisualizer from './AudioVisualizer';

interface AudioCaptureProps {
  onAudioData?: (frequencyData: Uint8Array, timeData: Uint8Array) => void;
  onBufferReady?: (buffer: Float32Array) => void;
  onQualityUpdate?: (metrics: AudioQualityMetrics) => void;
  onError?: (error: Error) => void;
  isActive?: boolean;
}

export default function AudioCapture({
  onAudioData,
  onBufferReady,
  onQualityUpdate,
  onError,
  isActive = true
}: AudioCaptureProps): React.ReactElement {
  const [isRecording, setIsRecording] = useState(false);
  const [currentFrequencyData, setCurrentFrequencyData] = useState<Uint8Array | null>(null);
  const [currentTimeData, setCurrentTimeData] = useState<Uint8Array | null>(null);
  const [qualityMetrics, setQualityMetrics] = useState<AudioQualityMetrics | null>(null);
  
  const analyzerRef = useRef<AudioAnalyzerResult | null>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const audioBufferRef = useRef<AudioBuffer | null>(null);

  const startAnalysis = useCallback(() => {
    if (!analyzerRef.current || !isActive) return;

    const { analyser, dataArray } = analyzerRef.current;
    const { frequencyData, timeData } = getAudioData(analyser, dataArray);
    
    // Update visualization data
    setCurrentFrequencyData(frequencyData);
    setCurrentTimeData(timeData);
    
    // Calculate and update quality metrics
    const metrics = calculateAudioQuality(frequencyData, timeData);
    setQualityMetrics(metrics);
    onQualityUpdate?.(metrics);

    // Process audio buffer
    if (audioBufferRef.current) {
      const floatData = new Float32Array(timeData.length);
      for (let i = 0; i < timeData.length; i++) {
        floatData[i] = (timeData[i] - 128) / 128.0;
      }
      audioBufferRef.current.addSamples(floatData);

      // Check if buffer is ready
      if (audioBufferRef.current.isBufferFull()) {
        const buffer = audioBufferRef.current.getBuffer();
        if (buffer) {
          onBufferReady?.(buffer);
        }
      }
    }
    
    // Call original callback
    onAudioData?.(frequencyData, timeData);
    
    animationFrameRef.current = requestAnimationFrame(startAnalysis);
  }, [isActive, onAudioData, onBufferReady, onQualityUpdate]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      analyzerRef.current = setupAudioAnalyzer(stream);
      
      // Initialize audio buffer
      const audioContext = analyzerRef.current.audioContext;
      audioBufferRef.current = new AudioBuffer({
        bufferSize: 4096, // 4KB buffer
        overlap: 1024,    // 1KB overlap
        sampleRate: audioContext.sampleRate
      });

      setIsRecording(true);
      startAnalysis();
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('Failed to start recording'));
    }
  }, [onError, startAnalysis]);

  const stopRecording = useCallback(() => {
    if (analyzerRef.current) {
      cleanupAudioAnalyzer(analyzerRef.current);
      analyzerRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioBufferRef.current) {
      audioBufferRef.current = null;
    }
    setIsRecording(false);
  }, []);

  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, [stopRecording]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">Audio Capture</h2>
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
            isRecording
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>
      </div>

      {isRecording && currentFrequencyData && currentTimeData && (
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-700 mb-2">Audio Visualization</h3>
            <AudioVisualizer
              frequencyData={currentFrequencyData}
              timeData={currentTimeData}
              width={600}
              height={200}
            />
          </div>

          {qualityMetrics && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-700 mb-2">Audio Quality Metrics</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-white p-3 rounded-lg shadow">
                  <div className="text-sm text-gray-500">Signal Level</div>
                  <div className="text-lg font-semibold text-gray-800">
                    {(qualityMetrics.signalLevel * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg shadow">
                  <div className="text-sm text-gray-500">Noise Level</div>
                  <div className="text-lg font-semibold text-gray-800">
                    {(qualityMetrics.noiseLevel * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg shadow">
                  <div className="text-sm text-gray-500">Clipping</div>
                  <div className="text-lg font-semibold text-gray-800">
                    {(qualityMetrics.clipping * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg shadow">
                  <div className="text-sm text-gray-500">Frequency Range</div>
                  <div className="text-lg font-semibold text-gray-800">
                    {(qualityMetrics.frequencyRange * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg shadow col-span-2 md:col-span-3">
                  <div className="text-sm text-gray-500">Overall Quality Score</div>
                  <div className="text-2xl font-bold text-gray-800">
                    {qualityMetrics.qualityScore}/100
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 