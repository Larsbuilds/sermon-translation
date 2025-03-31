export interface AudioQualityMetrics {
  signalStrength: number;  // 0-1, higher is better
  noiseLevel: number;     // 0-1, lower is better
  clarity: number;        // 0-1, higher is better
  qualityScore: number;   // 0-100, overall quality score
} 