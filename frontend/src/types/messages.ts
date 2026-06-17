// NOTE: In a production codebase, these types would live in a shared package
// (e.g., @app/shared-types) to ensure frontend and backend stay in sync.
// For this project, they are manually mirrored from backend/src/websocket/messageTypes.ts.

export interface LearningCard {
  title: string;
  keyConcept: string;
  funFact: string;
}

// Client → Server messages
export interface GenerateRequest {
  type: 'GENERATE_REQUEST';
  topic: string;
  mode: 'success' | 'failure';
}

export interface RetryCardMessage {
  type: 'RETRY_CARD';
  cardIndex: number;
  topic: string;
}

export type ClientMessage = GenerateRequest | RetryCardMessage;

// Server → Client messages
export interface GenerationStarted {
  type: 'GENERATION_STARTED';
  topic: string;
  totalCards: number;
}

export interface CardLoading {
  type: 'CARD_LOADING';
  cardIndex: number;
}

export interface CardReady {
  type: 'CARD_READY';
  cardIndex: number;
  card: LearningCard;
}

export interface CardError {
  type: 'CARD_ERROR';
  cardIndex: number;
  message: string;
}

export interface GenerationComplete {
  type: 'GENERATION_COMPLETE';
}

export interface ServerError {
  type: 'SERVER_ERROR';
  message: string;
}

export type ServerMessage =
  | GenerationStarted
  | CardLoading
  | CardReady
  | CardError
  | GenerationComplete
  | ServerError;

// Card states for the UI
export type CardStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface CardState {
  status: CardStatus;
  card?: LearningCard;
  errorMessage?: string;
}

export type GenerationState = 'idle' | 'connecting' | 'generating' | 'error' | 'complete';
