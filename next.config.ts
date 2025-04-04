import type { Configuration as WebpackConfig } from 'webpack';

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config: WebpackConfig) => {
    config.externals = [...(config.externals as any[]), { bufferutil: "bufferutil", "utf-8-validate": "utf-8-validate" }];
    return config;
  },
  env: {
    NEXT_PUBLIC_WEBSOCKET_URL: process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:3002',
    NEXT_PUBLIC_WEBRTC_URL: process.env.NEXT_PUBLIC_WEBRTC_URL || 'ws://localhost:3002/webrtc',
  },
};

export default nextConfig;
