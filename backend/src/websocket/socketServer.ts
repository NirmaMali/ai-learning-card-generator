import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { ClientMessage } from './messageTypes';
import { generateCards, retryCard } from '../services/cardGenerator';
import { logger } from '../utils/logger';

// Track whether a connection is currently processing a generation request.
// This prevents concurrent generate requests from the same client, which could
// cause interleaved card messages and corrupt the UI state.
const activeGenerations = new WeakMap<WebSocket, boolean>();

// Simple per-connection rate limit: reject rapid repeated Generate clicks.
const RATE_LIMIT_MS = 2_000;
const lastGenerateAt = new WeakMap<WebSocket, number>();

// Heartbeat interval — detect dead connections
const HEARTBEAT_INTERVAL_MS = 30_000;

interface ExtendedWebSocket extends WebSocket {
  isAlive?: boolean;
}

export function createWebSocketServer(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server });

  logger.info('WebSocket server created');

  // Heartbeat: periodically ping all clients and terminate unresponsive ones.
  // This ensures dropped connections (e.g., network loss without a clean close)
  // are detected and cleaned up rather than silently hanging.
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const extWs = ws as ExtendedWebSocket;
      if (extWs.isAlive === false) {
        logger.warn('Terminating unresponsive WebSocket client');
        return extWs.terminate();
      }
      extWs.isAlive = false;
      extWs.ping();
    });
  }, HEARTBEAT_INTERVAL_MS);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  wss.on('connection', (ws: ExtendedWebSocket) => {
    logger.info('New WebSocket connection established');
    ws.isAlive = true;
    activeGenerations.set(ws, false);

    // Respond to pong to keep heartbeat alive
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', async (data) => {
      let message: ClientMessage;

      // Parse and validate incoming messages
      try {
        message = JSON.parse(data.toString()) as ClientMessage;
      } catch {
        logger.warn(
          `Received malformed message: ${data.toString().substring(0, 100)}`
        );
        ws.send(
          JSON.stringify({
            type: 'SERVER_ERROR',
            message: 'Malformed message: expected valid JSON',
          })
        );
        return;
      }

      // Route messages by type
      switch (message.type) {
        case 'GENERATE_REQUEST':
          await handleGenerateRequest(ws, message.topic, message.mode);
          break;

        case 'RETRY_CARD':
          await handleRetryCard(ws, message.topic, message.cardIndex);
          break;

        default:
          logger.warn(
            `Unknown message type received: ${(message as any).type}`
          );
          ws.send(
            JSON.stringify({
              type: 'SERVER_ERROR',
              message: `Unknown message type: ${(message as any).type}`,
            })
          );
      }
    });

    ws.on('close', (code, reason) => {
      logger.info(
        `WebSocket connection closed (code: ${code}, reason: ${reason.toString() || 'none'})`
      );
      activeGenerations.delete(ws);
    });

    ws.on('error', (error) => {
      logger.error(`WebSocket error: ${error.message}`);
    });
  });

  return wss;
}

/**
 * Handles a GENERATE_REQUEST message.
 * Guards against concurrent requests — if a generation is already in progress
 * for this connection, the new request is rejected with an error message.
 */
async function handleGenerateRequest(
  ws: WebSocket,
  topic: string,
  mode: 'success' | 'failure'
): Promise<void> {
  // Input validation
  if (!topic || typeof topic !== 'string') {
    ws.send(
      JSON.stringify({
        type: 'SERVER_ERROR',
        message: 'Topic is required and must be a non-empty string.',
      })
    );
    return;
  }

  const trimmedTopic = topic.trim();
  if (trimmedTopic.length === 0) {
    ws.send(
      JSON.stringify({
        type: 'SERVER_ERROR',
        message: 'Topic cannot be empty or whitespace only.',
      })
    );
    return;
  }

  if (trimmedTopic.length > 200) {
    ws.send(
      JSON.stringify({
        type: 'SERVER_ERROR',
        message: 'Topic is too long (max 200 characters).',
      })
    );
    return;
  }

  const now = Date.now();
  const lastAt = lastGenerateAt.get(ws) ?? 0;
  if (now - lastAt < RATE_LIMIT_MS) {
    logger.warn('Rejected GENERATE_REQUEST — rate limit exceeded');
    ws.send(
      JSON.stringify({
        type: 'SERVER_ERROR',
        message: 'Please wait a moment before generating again.',
      })
    );
    return;
  }

  // Concurrency guard: reject if already generating
  if (activeGenerations.get(ws)) {
    logger.warn(
      'Rejected concurrent GENERATE_REQUEST — generation already in progress'
    );
    ws.send(
      JSON.stringify({
        type: 'SERVER_ERROR',
        message:
          'A generation is already in progress. Please wait for it to complete.',
      })
    );
    return;
  }

  activeGenerations.set(ws, true);
  lastGenerateAt.set(ws, now);
  logger.info(
    `Starting generation for topic "${trimmedTopic}" in ${mode} mode`
  );

  try {
    await generateCards(ws, trimmedTopic, mode);
  } catch (error) {
    logger.error(`Unexpected error in generateCards: ${error}`);
    ws.send(
      JSON.stringify({
        type: 'SERVER_ERROR',
        message: 'An unexpected server error occurred during generation.',
      })
    );
  } finally {
    activeGenerations.set(ws, false);
  }
}

/**
 * Handles a RETRY_CARD message.
 * Same concurrency guard applies — can't retry while generating.
 */
async function handleRetryCard(
  ws: WebSocket,
  topic: string,
  cardIndex: number
): Promise<void> {
  if (!topic || !cardIndex || cardIndex < 1 || cardIndex > 3) {
    ws.send(
      JSON.stringify({
        type: 'SERVER_ERROR',
        message:
          'Invalid retry request: topic and valid cardIndex (1-3) are required.',
      })
    );
    return;
  }

  if (activeGenerations.get(ws)) {
    logger.warn('Rejected RETRY_CARD — generation already in progress');
    ws.send(
      JSON.stringify({
        type: 'SERVER_ERROR',
        message: 'Cannot retry while a generation is in progress.',
      })
    );
    return;
  }

  activeGenerations.set(ws, true);

  try {
    await retryCard(ws, topic, cardIndex);
  } catch (error) {
    logger.error(`Unexpected error in retryCard: ${error}`);
    ws.send(
      JSON.stringify({
        type: 'SERVER_ERROR',
        message: 'An unexpected server error occurred during retry.',
      })
    );
  } finally {
    activeGenerations.set(ws, false);
  }
}
