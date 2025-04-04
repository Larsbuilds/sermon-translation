const websocketUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:3002';
const webrtcUrl = process.env.NEXT_PUBLIC_WEBRTC_URL || 'ws://localhost:3002/webrtc';

export const websocketConfig = {
  websocketUrl,
  webrtcUrl,
};