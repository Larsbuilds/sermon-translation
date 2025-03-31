export interface AudioBufferConfig {
  bufferSize: number;      // Size of each buffer in samples
  overlap: number;         // Number of samples to overlap between buffers
  sampleRate: number;      // Audio sample rate
}

export class AudioBuffer {
  private buffer: Float32Array;
  private position: number;
  private readonly size: number;

  constructor(size: number = 4096) {
    this.size = size;
    this.buffer = new Float32Array(size);
    this.position = 0;
  }

  addData(data: Uint8Array) {
    const floatData = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) {
      floatData[i] = (data[i] - 128) / 128.0;
    }

    for (let i = 0; i < floatData.length; i++) {
      this.buffer[this.position] = floatData[i];
      this.position = (this.position + 1) % this.size;
    }
  }

  isReady(): boolean {
    return this.position >= this.size;
  }

  getData(): Float32Array {
    return this.buffer;
  }

  reset() {
    this.position = 0;
    this.buffer.fill(0);
  }
} 