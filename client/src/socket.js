import { io } from 'socket.io-client';

const PROD_BACKEND = 'https://bafly-ej4m.onrender.com';

const isLocal =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const SOCKET_URL = isLocal
  ? (import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || 'http://localhost:3001')
  : (import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || PROD_BACKEND);

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});
