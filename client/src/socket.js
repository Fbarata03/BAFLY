import { io } from 'socket.io-client';

const PROD_BACKEND = 'https://bafly-server-production-49a3.up.railway.app';

const isHostedFrontend =
  window.location.hostname === 'bafly.net' ||
  window.location.hostname.endsWith('.netlify.app');

const SOCKET_URL =
  (isHostedFrontend ? PROD_BACKEND : (import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL)) ||
  (window.location.hostname === 'localhost' ? 'http://localhost:3001' : PROD_BACKEND);

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});
