import { WebSocket } from 'ws';
import { generateLearningCard } from './aiService';
import { ServerMessage } from '../websocket/messageTypes';
import { logger } from '../utils/logger';

// Helper to send typed messages over WebSocket
function sendMessage(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

/**
 * Generates learning cards sequentially and streams them to the client.
 *
 * Cards are generated ONE AT A TIME — the next LLM call doesn't start until
 * the previous card has been sent to the client. This creates genuine
 * progressive streaming behavior (not simulated with client-side delays).
 *
 * In 'failure' mode, card 3 intentionally fails to demonstrate error handling
 * and the retry flow. This is a DELIBERATE test scenario, not a bug.
 */
export async function generateCards(
  ws: WebSocket,
  topic: string,
  mode: 'success' | 'failure'
): Promise<void> {
  const totalCards = 3;

  // Signal the start of generation
  sendMessage(ws, {
    type: 'GENERATION_STARTED',
    topic,
    totalCards,
  });

  for (let i = 1; i <= totalCards; i++) {
    // Signal that this specific card is now being generated
    sendMessage(ws, { type: 'CARD_LOADING', cardIndex: i });

    try {
      // INTENTIONAL FAILURE: In 'failure' mode, card 3 always fails.
      // This is a deliberate test scenario to demonstrate error handling
      // and the retry mechanism. The error is deterministic and controlled.
      if (mode === 'failure' && i === 3) {
        // Deterministic, intentional failure — never flaky, always card 3 only.
        throw new Error(
          'Failed to generate card 3. This is a simulated failure for testing purposes — cards 1 and 2 are unaffected. Please click Retry.'
        );
      }

      // Generate the card via the AI service (real LLM call)
      const card = await generateLearningCard(topic, i);

      sendMessage(ws, {
        type: 'CARD_READY',
        cardIndex: i,
        card,
      });

      logger.info(`Card ${i}/${totalCards} sent for topic "${topic}"`);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : `Unknown error generating card ${i}`;

      logger.warn(`Card ${i} failed: ${errorMessage}`);

      sendMessage(ws, {
        type: 'CARD_ERROR',
        cardIndex: i,
        message: errorMessage,
      });

      // On error, stop generating further cards — the client can retry
      // the failed card specifically via RETRY_CARD
      return;
    }
  }

  // All cards generated successfully
  sendMessage(ws, { type: 'GENERATION_COMPLETE' });
  logger.info(`All ${totalCards} cards generated for topic "${topic}"`);
}

/**
 * Retries generation for a single failed card.
 *
 * This ALWAYS succeeds regardless of the original mode — once a user clicks
 * Retry, we force success so the demo flow completes cleanly.
 * The retry uses the SAME WebSocket connection (no reconnect needed).
 */
export async function retryCard(
  ws: WebSocket,
  topic: string,
  cardIndex: number
): Promise<void> {
  logger.info(`Retrying card ${cardIndex} for topic "${topic}"`);

  // Show loading state for the retried card
  sendMessage(ws, { type: 'CARD_LOADING', cardIndex });

  try {
    // Force success on retry — this is intentional so the demo always completes
    const card = await generateLearningCard(topic, cardIndex);

    sendMessage(ws, {
      type: 'CARD_READY',
      cardIndex,
      card,
    });

    // After successful retry, the full set is complete
    sendMessage(ws, { type: 'GENERATION_COMPLETE' });
    logger.info(`Retry successful for card ${cardIndex}`);
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : `Unknown error retrying card ${cardIndex}`;

    logger.error(`Retry failed for card ${cardIndex}: ${errorMessage}`);

    sendMessage(ws, {
      type: 'CARD_ERROR',
      cardIndex,
      message: `Retry failed: ${errorMessage}`,
    });
  }
}
