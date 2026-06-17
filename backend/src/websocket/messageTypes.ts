// NOTE: In a production codebase, these types would live in a shared package
// (e.g., @app/shared-types) to ensure frontend and backend stay in sync.
// For this project, they are manually mirrored in frontend/src/types/messages.ts.

// ──────────────────────────────────────────────
// Shared types
// ──────────────────────────────────────────────

/** A single learning card returned by the AI service. */
export interface LearningCard {
  title: string;
  keyConcept: string;
  funFact: string;
}

// ──────────────────────────────────────────────
// Client → Server messages
// ──────────────────────────────────────────────

/** Request to generate a full set of learning cards for a topic. */
export interface GenerateRequest {
  type: 'GENERATE_REQUEST';
  topic: string;
  mode: 'success' | 'failure';
}

/** Request to retry generation for a single failed card. */
export interface RetryCard {
  type: 'RETRY_CARD';
  cardIndex: number;
  topic: string;
}

/** Union of all messages the client can send. */
export type ClientMessage = GenerateRequest | RetryCard;

// ──────────────────────────────────────────────
// Server → Client messages
// ──────────────────────────────────────────────

/** Signals the start of a card generation batch. */
export interface GenerationStarted {
  type: 'GENERATION_STARTED';
  topic: string;
  totalCards: number;
}

/** Signals that a specific card is currently being generated. */
export interface CardLoading {
  type: 'CARD_LOADING';
  cardIndex: number;
}

/** Delivers a successfully generated card to the client. */
export interface CardReady {
  type: 'CARD_READY';
  cardIndex: number;
  card: LearningCard;
}

/** Reports a failure to generate a specific card. */
export interface CardError {
  type: 'CARD_ERROR';
  cardIndex: number;
  message: string;
}

/** Signals that all cards have been generated successfully. */
export interface GenerationComplete {
  type: 'GENERATION_COMPLETE';
}

/** Reports a server-level error (bad input, unexpected crash, etc.). */
export interface ServerError {
  type: 'SERVER_ERROR';
  message: string;
}

/** Union of all messages the server can send. */
export type ServerMessage =
  | GenerationStarted
  | CardLoading
  | CardReady
  | CardError
  | GenerationComplete
  | ServerError;
