import '../loadEnv';
import OpenAI from 'openai';
import { LearningCard } from '../websocket/messageTypes';
import { logger } from '../utils/logger';

/** Typed error for malformed or failed AI responses — callers can distinguish from network errors. */
export class AIServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIServiceError';
  }
}

type OpenRouterClient = OpenAI;

let openRouterClient: OpenRouterClient | null = null;

function getOpenRouterClient(): OpenRouterClient {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new AIServiceError(
      'OPENROUTER_API_KEY is not set. Add it to backend/.env and restart the server.'
    );
  }
  if (!openRouterClient) {
    openRouterClient = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'http://localhost:5173',
        'X-Title': 'AI Learning Card Generator',
      },
    });
  }
  return openRouterClient;
}

/**
 * Generates a single learning card for the given topic using OpenRouter.
 *
 * Design note: This function is the ONLY place where the LLM provider is called.
 * Swapping to OpenRouter or another provider requires changing only this file —
 * the rest of the application depends only on the LearningCard return type.
 *
 * @param topic - The topic to generate a card about
 * @param cardIndex - The card number (1, 2, or 3)
 * @param previousCards - Array of previously generated cards to ensure content diversity
 */
export async function generateLearningCard(
  topic: string,
  cardIndex: number,
  previousCards: LearningCard[] = []
): Promise<LearningCard> {
  // Build context about previously generated cards
  let previousContext = '';
  if (previousCards.length > 0) {
    previousContext =
      '\n\nPreviously generated cards for this topic:\n' +
      previousCards
        .map(
          (card, idx) =>
            `Card ${idx + 1}:\n  Title: ${card.title}\n  Key Concept: ${card.keyConcept}\n  Fun Fact: ${card.funFact}`
        )
        .join('\n\n');
    previousContext +=
      '\n\nIMPORTANT: Generate a card that covers a COMPLETELY DIFFERENT aspect and perspective. Do NOT repeat or overlap with the titles, concepts, or facts above.';
  }

  // Use a well-structured prompt that instructs the model to return strict JSON
  const prompt = `You are an educational content creator. Generate a learning card about the topic: "${topic}".

This is card ${cardIndex} of 3, so make it cover a DIFFERENT aspect of the topic than the other cards would.${previousContext}

Respond with ONLY valid JSON in this exact format (no markdown, no code fences):
{
  "title": "A concise, engaging title for this specific aspect",
  "keyConcept": "A clear explanation in 2-3 sentences covering one key concept about this topic",
  "funFact": "An interesting, surprising, or lesser-known fact related to this aspect of the topic"
}`;

  try {
    const response = await getOpenRouterClient().chat.completions.create({
      model: 'openai/gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful educational assistant that generates learning cards. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 300,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new AIServiceError('Empty response from AI provider');
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content) as Record<string, unknown>;
    } catch {
      throw new AIServiceError('AI response was not valid JSON');
    }

    // Validate the required fields exist
    if (!parsed.title || !parsed.keyConcept || !parsed.funFact) {
      throw new AIServiceError(
        `Malformed AI response: missing required fields. Got keys: ${Object.keys(parsed).join(', ')}`
      );
    }

    const card: LearningCard = {
      title: String(parsed.title),
      keyConcept: String(parsed.keyConcept),
      funFact: String(parsed.funFact),
    };

    logger.info(`Successfully generated card ${cardIndex} for topic "${topic}"`);
    return card;
  } catch (error) {
    // Re-throw with context so callers get a clear error message
    const message =
      error instanceof Error ? error.message : 'Unknown AI service error';
    logger.error(`AI service error for card ${cardIndex}: ${message}`);
    throw new AIServiceError(`Failed to generate card ${cardIndex}: ${message}`);
  }
}
