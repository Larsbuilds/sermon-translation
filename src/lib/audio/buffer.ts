export interface AudioBufferConfig {
  bufferSize: number;      // Size of each buffer in samples
  overlap: number;         // Number of samples to overlap between buffers
  sampleRate: number;      // Audio sample rate
}

export class AudioBuffer {
  private buffer: Float32Array;
  private position: number = 0;
  private config: AudioBufferConfig;
  private isFull: boolean = false;

  constructor(config: AudioBufferConfig) {
    this.config = config;
    this.buffer = new Float32Array(config.bufferSize);
  }

  addSamples(samples: Float32Array): void {
    const remainingSpace = this.config.bufferSize - this.position;
    const samplesToAdd = Math.min(samples.length, remainingSpace);

    // Add samples to buffer
    this.buffer.set(samples.slice(0, samplesToAdd), this.position);
    this.position += samplesToAdd;

    // Check if buffer is full
    if (this.position >= this.config.bufferSize) {
      this.isFull = true;
    }

    // If we have more samples than space, keep the overlap
    if (samples.length > samplesToAdd) {
      const overlapSamples = samples.slice(samples.length - this.config.overlap);
      this.buffer.set(overlapSamples, 0);
      this.position = this.config.overlap;
    }
  }

  getBuffer(): Float32Array | null {
    if (!this.isFull) {
      return null;
    }

    // Create a copy of the current buffer
    const result = new Float32Array(this.buffer);
    
    // Shift the buffer by overlap amount
    this.buffer.copyWithin(0, this.config.overlap);
    this.position -= this.config.overlap;
    this.isFull = false;

    return result;
  }

  isBufferFull(): boolean {
    return this.isFull;
  }

  getBufferProgress(): number {
    return this.position / this.config.bufferSize;
  }

  reset(): void {
    this.position = 0;
    this.isFull = false;
    this.buffer.fill(0);
  }
} 