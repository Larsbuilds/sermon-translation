export interface AudioQualityMetrics {
  signalLevel: number;      // 0-1
  noiseLevel: number;       // 0-1
  clipping: number;         // 0-1
  frequencyRange: number;   // 0-1
  qualityScore: number;     // 0-100
}

export const calculateAudioQuality = (
  frequencyData: Uint8Array,
  timeData: Uint8Array
): AudioQualityMetrics => {
  // Calculate signal level (average amplitude)
  const signalLevel = timeData.reduce((sum, val) => sum + val, 0) / (timeData.length * 255);

  // Calculate noise level (high-frequency components)
  const noiseThreshold = 0.7; // 70% of frequency range
  const noiseLevel = frequencyData.reduce((sum, val, i) => {
    const normalizedFreq = i / frequencyData.length;
    return sum + (normalizedFreq > noiseThreshold ? val / 255 : 0);
  }, 0) / frequencyData.length;

  // Calculate clipping (samples at maximum amplitude)
  const clippingThreshold = 0.95; // 95% of maximum amplitude
  const clipping = timeData.reduce((count, val) => 
    count + (val > clippingThreshold * 255 ? 1 : 0), 0) / timeData.length;

  // Calculate frequency range (how much of the frequency spectrum is used)
  const frequencyRange = frequencyData.reduce((sum, val) => 
    sum + (val > 0 ? 1 : 0), 0) / frequencyData.length;

  // Calculate overall quality score
  const qualityScore = Math.round(
    (signalLevel * 0.3 +           // Signal level weight
    (1 - noiseLevel) * 0.2 +       // Inverse noise level weight
    (1 - clipping) * 0.2 +         // Inverse clipping weight
    frequencyRange * 0.3) * 100    // Frequency range weight
  );

  return {
    signalLevel,
    noiseLevel,
    clipping,
    frequencyRange,
    qualityScore
  };
}; 