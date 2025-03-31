import type { AudioContext, AnalyserNode, MediaStream } from 'web-audio-api';

export interface AudioAnalyzerConfig {
  fftSize?: number;
  smoothingTimeConstant?: number;
  minDecibels?: number;
  maxDecibels?: number;
}

export interface AudioAnalyzerResult {
  analyser: AnalyserNode;
  dataArray: Uint8Array;
  audioContext: AudioContext;
  source: MediaStreamAudioSourceNode;
}

export const setupAudioAnalyzer = (
  stream: MediaStream,
  config: AudioAnalyzerConfig = {}
): AudioAnalyzerResult => {
  const {
    fftSize = 256,
    smoothingTimeConstant = 0.8,
    minDecibels = -90,
    maxDecibels = -10
  } = config;

  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();

  // Configure analyzer
  analyser.fftSize = fftSize;
  analyser.smoothingTimeConstant = smoothingTimeConstant;
  analyser.minDecibels = minDecibels;
  analyser.maxDecibels = maxDecibels;

  // Connect nodes
  source.connect(analyser);

  // Create data array for frequency data
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  return {
    analyser,
    dataArray,
    audioContext,
    source
  };
};

export const getAudioData = (
  analyser: AnalyserNode,
  dataArray: Uint8Array
): {
  frequencyData: Uint8Array;
  timeData: Uint8Array;
} => {
  // Get frequency data
  analyser.getByteFrequencyData(dataArray);
  const frequencyData = new Uint8Array(dataArray);

  // Get time domain data
  const timeData = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteTimeDomainData(timeData);

  return {
    frequencyData,
    timeData
  };
};

export const cleanupAudioAnalyzer = (
  result: AudioAnalyzerResult
): void => {
  result.source.disconnect();
  result.audioContext.close();
}; 