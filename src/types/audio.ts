export interface AudioQualityMetrics {
  signalLevel: number;    // 0-1
  noiseLevel: number;     // 0-1
  clipping: number;       // 0-1
  frequencyRange: number; // 0-1
  qualityScore: number;   // 0-100
} 