import './loadEnv';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { createWebSocketServer } from './websocket/socketServer';
import { logger } from './utils/logger';

const PORT = parseInt(process.env.PORT || '4000', 10);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint — useful for monitoring and verifying the server is running
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Create HTTP server from Express app — needed so we can attach
// the WebSocket server to the same port (WS upgrade happens on the
// HTTP server, not on Express directly)
const server = http.createServer(app);

// Attach WebSocket server to the HTTP server
const wss = createWebSocketServer(server);

server.listen(PORT, () => {
  const keyLoaded = Boolean(process.env.GEMINI_API_KEY);
  logger.info(`Server running on http://localhost:${PORT}`);
  logger.info(`WebSocket server ready on ws://localhost:${PORT}`);
  logger.info(keyLoaded ? 'Gemini API key loaded.' : 'WARNING: GEMINI_API_KEY is missing - check backend/.env');
  logger.info('Waiting for connections...');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  wss.close();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down...');
  wss.close();
  server.close(() => {
    process.exit(0);
  });
});
