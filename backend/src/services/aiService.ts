import '../loadEnv';
import { LearningCard } from '../websocket/messageTypes';
import { logger } from '../utils/logger';

/** Typed error for malformed or failed AI responses — callers can distinguish from network errors. */
export class AIServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIServiceError';
  }
}

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

function getGeminiApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AIServiceError(
      'GEMINI_API_KEY is not set. Add it to backend/.env and restart the server.'
    );
  }
  return apiKey;
}

/**
 * Generates a single learning card for the given topic using Gemini.
 *
 * Design note: This function is the ONLY place where the LLM provider is called.
 * Swapping to Gemini or another provider requires changing only this file —
 * the rest of the application depends only on the LearningCard return type.
 */
export async function generateLearningCard(
  topic: string,
  cardIndex: number
): Promise<LearningCard> {
  // Use a well-structured prompt that instructs the model to return strict JSON
  const prompt = `You are an educational content creator. Generate a learning card about the topic: "${topic}".

This is card ${cardIndex} of 3, so make it cover a DIFFERENT aspect of the topic than the other cards would.

Respond with ONLY valid JSON in this exact format (no markdown, no code fences):
{
  "title": "A concise, engaging title for this specific aspect",
  "keyConcept": "A clear explanation in 2-3 sentences covering one key concept about this topic",
  "funFact": "An interesting, surprising, or lesser-known fact related to this aspect of the topic"
}`;

  try {
    const apiKey = getGeminiApiKey();
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: 'You are a helpful educational assistant that generates learning cards. Always respond with valid JSON only.',
              },
            ],
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 300,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    const payload = (await response.json()) as GeminiGenerateContentResponse;
    if (!response.ok) {
      const providerMessage = payload.error?.message || response.statusText;
      throw new AIServiceError(
        `Gemini request failed (${response.status}): ${providerMessage}`
      );
    }

    const content = payload.candidates?.[0]?.content?.parts?.[0]?.text;
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
