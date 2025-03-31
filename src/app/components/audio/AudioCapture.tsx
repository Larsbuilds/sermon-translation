'use client';

import React, { useEffect, useRef, useState } from 'react';
import { setupAudioAnalyzer, getAudioData, cleanupAudioAnalyzer, AudioAnalyzerResult } from '../../../lib/audio/analyzer';
import { calculateAudioQuality, AudioQualityMetrics } from '../../../lib/audio/quality';
import { AudioBuffer, AudioBufferConfig } from '../../../lib/audio/buffer';
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
}: AudioCaptureProps): JSX.Element {
  const [isRecording, setIsRecording] = useState(false);
  const [currentFrequencyData, setCurrentFrequencyData] = useState<Uint8Array | null>(null);
  const [currentTimeData, setCurrentTimeData] = useState<Uint8Array | null>(null);
  const [qualityMetrics, setQualityMetrics] = useState<AudioQualityMetrics | null>(null);
  
  const analyzerRef = useRef<AudioAnalyzerResult | null>(null);
  const animationFrameRef = useRef<number>();
  const audioBufferRef = useRef<AudioBuffer | null>(null);

  const startRecording = async () => {
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
  };

  const stopRecording = () => {
    if (analyzerRef.current) {
      cleanupAudioAnalyzer(analyzerRef.current);
      analyzerRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioBufferRef.current) {
      audioBufferRef.current.reset();
      audioBufferRef.current = null;
    }
    setIsRecording(false);
  };

  const startAnalysis = () => {
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
    <div className="w-full max-w-4xl mx-auto p-6 bg-white rounded-xl shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Audio Capture</h2>
        <button
          onClick={() => isRecording ? stopRecording() : startRecording()}
          className={`px-6 py-3 rounded-lg font-semibold text-white transition-all duration-200 transform hover:scale-105 ${
            isRecording
              ? 'bg-red-500 hover:bg-red-600 shadow-red-200'
              : 'bg-blue-500 hover:bg-blue-600 shadow-blue-200'
          } shadow-lg`}
        >
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>
      </div>

      {isRecording && currentFrequencyData && currentTimeData && (
        <div className="space-y-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Audio Visualization</h3>
            <AudioVisualizer
              frequencyData={currentFrequencyData}
              timeData={currentTimeData}
              width={600}
              height={200}
            />
          </div>
          
          {qualityMetrics && (
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Audio Quality Metrics</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-medium text-gray-600">Signal Level</p>
                    <span className="text-sm text-gray-500">{Math.round(qualityMetrics.signalLevel * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${qualityMetrics.signalLevel * 100}%` }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-medium text-gray-600">Noise Level</p>
                    <span className="text-sm text-gray-500">{Math.round(qualityMetrics.noiseLevel * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-red-600 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${qualityMetrics.noiseLevel * 100}%` }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-medium text-gray-600">Clipping</p>
                    <span className="text-sm text-gray-500">{Math.round(qualityMetrics.clipping * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-yellow-600 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${qualityMetrics.clipping * 100}%` }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-medium text-gray-600">Quality Score</p>
                    <span className="text-sm text-gray-500">{qualityMetrics.qualityScore}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full transition-all duration-300 ${
                        qualityMetrics.qualityScore > 80
                          ? 'bg-green-600'
                          : qualityMetrics.qualityScore > 60
                          ? 'bg-yellow-600'
                          : 'bg-red-600'
                      }`}
                      style={{ width: `${qualityMetrics.qualityScore}%` }}
                    />
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