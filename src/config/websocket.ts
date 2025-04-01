export const WS_CONFIG = {
  port: process.env.NEXT_PUBLIC_WS_PORT || 3001,
  host: process.env.NEXT_PUBLIC_WS_HOST || (typeof window !== 'undefined' ? window.location.hostname : 'localhost'),
  path: '/api/audio',
  protocol: process.env.NODE_ENV === 'production' ? 'wss' : 'ws',
};

export const getWebSocketUrl = (sessionId: string) => {
  const { protocol, host, port, path } = WS_CONFIG;
  return `${protocol}://${host}${port ? `:${port}` : ''}${path}?sessionId=${sessionId}`;
}; 