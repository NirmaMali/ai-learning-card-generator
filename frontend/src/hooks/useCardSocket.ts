import { useRef, useState, useCallback, useEffect } from 'react';
import type { CardState, GenerationState, ServerMessage, ClientMessage } from '../types/messages';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:4000';
const TOTAL_CARDS = 3;

const initialCards = (): CardState[] =>
  Array.from({ length: TOTAL_CARDS }, () => ({ status: 'idle' as const }));

export function useCardSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const [cards, setCards] = useState<CardState[]>(initialCards());
  const [generationState, setGenerationState] = useState<GenerationState>('idle');
  const [currentTopic, setCurrentTopic] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connected' | 'error'>('disconnected');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const generationStateRef = useRef<GenerationState>(generationState);

  // Keep ref in sync so the onclose handler reads current state
  useEffect(() => {
    generationStateRef.current = generationState;
  }, [generationState]);

  // Handle incoming server messages — this is the state machine core
  const handleServerMessage = useCallback((message: ServerMessage) => {
    switch (message.type) {
      case 'GENERATION_STARTED':
        setGenerationState('generating');
        setStatusMessage(`Generating ${message.totalCards} cards for "${message.topic}"...`);
        break;

      case 'CARD_LOADING':
        setCards(prev => {
          const next = [...prev];
          next[message.cardIndex - 1] = { status: 'loading' };
          return next;
        });
        break;

      case 'CARD_READY':
        setCards(prev => {
          const next = [...prev];
          next[message.cardIndex - 1] = {
            status: 'ready',
            card: message.card,
          };
          return next;
        });
        break;

      case 'CARD_ERROR':
        setCards(prev => {
          const next = [...prev];
          next[message.cardIndex - 1] = {
            status: 'error',
            errorMessage: message.message,
          };
          return next;
        });
        setGenerationState('error');
        setStatusMessage('');
        break;

      case 'GENERATION_COMPLETE':
        setGenerationState('complete');
        setStatusMessage('All 3 cards generated.');
        break;

      case 'SERVER_ERROR':
        setGenerationState('error');
        setStatusMessage(message.message);
        break;
    }
  }, []);

  // Ensure WebSocket connection is established
  const ensureConnection = useCallback((): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      // If already connected, reuse
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        resolve(wsRef.current);
        return;
      }

      // If connecting, wait for it
      if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) {
        const ws = wsRef.current;
        ws.addEventListener('open', () => resolve(ws), { once: true });
        ws.addEventListener('error', () => reject(new Error('Connection failed')), { once: true });
        return;
      }

      // Create new connection
      setConnectionStatus('disconnected');
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus('connected');
        resolve(ws);
      };

      ws.onerror = () => {
        setConnectionStatus('error');
        reject(new Error('WebSocket connection failed'));
      };

      ws.onclose = () => {
        setConnectionStatus('disconnected');
        wsRef.current = null;
        // If we were in the middle of generating, surface the error
        if (generationStateRef.current === 'generating') {
          setGenerationState('error');
          setStatusMessage('Connection lost during generation. Please try again.');
        }
      };

      ws.onmessage = (event) => {
        try {
          const message: ServerMessage = JSON.parse(event.data);
          handleServerMessage(message);
        } catch {
          console.error('Failed to parse server message:', event.data);
        }
      };
    });
  }, [handleServerMessage]);

  // Send a typed message over the WebSocket
  const sendMessage = useCallback((message: ClientMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  // Generate cards for a topic
  const generate = useCallback(async (topic: string, mode: 'success' | 'failure') => {
    try {
      setGenerationState('connecting');
      setCurrentTopic(topic);
      setStatusMessage('Connecting...');

      // Reset cards to loading skeleton state
      setCards(Array.from({ length: TOTAL_CARDS }, () => ({ status: 'loading' as const })));

      const ws = await ensureConnection();

      // Attach message handler (in case it was reset on reconnect)
      ws.onmessage = (event) => {
        try {
          const message: ServerMessage = JSON.parse(event.data);
          handleServerMessage(message);
        } catch {
          console.error('Failed to parse server message:', event.data);
        }
      };

      sendMessage({ type: 'GENERATE_REQUEST', topic, mode });
    } catch {
      setGenerationState('error');
      setStatusMessage('Failed to connect to server. Is the backend running?');
    }
  }, [ensureConnection, sendMessage, handleServerMessage]);

  // Retry a specific failed card
  const retryCard = useCallback((cardIndex: number) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setStatusMessage('Connection lost. Please generate again.');
      return;
    }

    // Set just this card to loading
    setCards(prev => {
      const next = [...prev];
      next[cardIndex - 1] = { status: 'loading' };
      return next;
    });

    setGenerationState('generating');
    setStatusMessage(`Retrying card ${cardIndex}...`);

    sendMessage({ type: 'RETRY_CARD', cardIndex, topic: currentTopic });
  }, [sendMessage, currentTopic]);

  // Reset to initial state
  const reset = useCallback(() => {
    setCards(initialCards());
    setGenerationState('idle');
    setStatusMessage('');
    setCurrentTopic('');
  }, []);

  // Establish WebSocket on mount so the connection is ready before the first Generate click.
  // The same socket is reused for retries — never opened per-request.
  useEffect(() => {
    ensureConnection().catch(() => {
      // Connection failure is surfaced when the user tries to generate.
    });
  }, [ensureConnection]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return {
    cards,
    generationState,
    connectionStatus,
    statusMessage,
    currentTopic,
    generate,
    retryCard,
    reset,
    isGenerating: generationState === 'generating' || generationState === 'connecting',
  };
}
