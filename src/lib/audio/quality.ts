import { AudioQualityMetrics } from '../../types/audio';

export function calculateAudioQuality(
  frequencyData: Uint8Array,
  timeData: Uint8Array
): AudioQualityMetrics {
  // Calculate signal strength (average amplitude)
  let sum = 0;
  for (let i = 0; i < timeData.length; i++) {
    sum += Math.abs(timeData[i] - 128);
  }
  const signalStrength = Math.min(sum / (timeData.length * 128), 1);

  // Calculate noise level (standard deviation of amplitude)
  let variance = 0;
  const mean = sum / timeData.length;
  for (let i = 0; i < timeData.length; i++) {
    const diff = Math.abs(timeData[i] - 128) - mean;
    variance += diff * diff;
  }
  variance /= timeData.length;
  const noiseLevel = Math.min(Math.sqrt(variance) / 128, 1);

  // Calculate clarity (frequency distribution)
  let frequencySum = 0;
  let frequencyCount = 0;
  for (let i = 0; i < frequencyData.length; i++) {
    if (frequencyData[i] > 0) {
      frequencySum += frequencyData[i];
      frequencyCount++;
    }
  }
  const clarity = frequencyCount > 0 ? Math.min(frequencySum / (frequencyCount * 255), 1) : 0;

  // Calculate overall quality score
  const qualityScore = Math.round(
    ((signalStrength * 0.4) + ((1 - noiseLevel) * 0.3) + (clarity * 0.3)) * 100
  );

  return {
    signalStrength,
    noiseLevel,
    clarity,
    qualityScore
  };
} 