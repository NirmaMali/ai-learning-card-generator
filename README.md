# AI Learning Card Generator

A full-stack web application that generates educational learning cards from any topic using OpenRouter, streaming results to the browser **one card at a time over a persistent WebSocket connection**. Instead of a single REST request that blocks until all three cards are ready, the backend generates cards sequentially and pushes each `CARD_READY` event as soon as it completes — giving users immediate, progressive feedback. This makes real-time loading states, per-card errors, and targeted retries natural to implement and easy to observe in a demo.

---

## Setup Instructions

### Prerequisites

- **Node.js** 18+ and **npm**
- An **OpenRouter API key** ([openrouter.ai](https://openrouter.ai))

### 1. Clone and install

```bash
git clone <repository-url>
cd ai-learning-card-generator

# Install root dev dependency (concurrently) + both packages
npm install
npm run install:all
```

Or install each package separately:

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure environment variables

**Backend** — copy the example and add your API key:

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:

```env
OPENROUTER_API_KEY=sk-or-v1-your-key-here
PORT=4000
```

**Frontend** — copy the example:

```bash
cd frontend
cp .env.example .env
```

Edit `frontend/.env` (defaults work for local dev):

```env
VITE_WS_URL=ws://localhost:4000
```

> **Security:** The OpenRouter API key is read only on the backend. It is never bundled into the frontend.

---

## How to Run

### Option A — Both servers at once (recommended)

From the project root:

```bash
npm run dev
```

This starts the backend and frontend concurrently.

### Option B — Two terminals

**Terminal 1 — Backend:**

```bash
cd backend
npm run dev
```

**Terminal 2 — Frontend:**

```bash
cd frontend
npm run dev
```

### URLs

| Service   | URL                        |
|-----------|----------------------------|
| Frontend  | http://localhost:5173      |
| Backend   | http://localhost:4000      |
| WebSocket | ws://localhost:4000        |
| Health    | http://localhost:4000/health |

### Production build

```bash
npm run build          # builds both packages
cd backend && npm start
cd frontend && npm start   # serves built assets on port 4173
```

---

## WebSocket Flow

The app uses **one persistent WebSocket per browser tab**, opened when the app loads and reused for all generations and retries.

### Message contract

#### Client → Server

```json
{ "type": "GENERATE_REQUEST", "topic": "Photosynthesis", "mode": "success" }
{ "type": "RETRY_CARD", "cardIndex": 3, "topic": "Photosynthesis" }
```

#### Server → Client

```json
{ "type": "GENERATION_STARTED", "topic": "Photosynthesis", "totalCards": 3 }
{ "type": "CARD_LOADING", "cardIndex": 1 }
{ "type": "CARD_READY", "cardIndex": 1, "card": { "title": "...", "keyConcept": "...", "funFact": "..." } }
{ "type": "CARD_ERROR", "cardIndex": 3, "message": "Failed to generate card 3. Please retry." }
{ "type": "GENERATION_COMPLETE" }
{ "type": "SERVER_ERROR", "message": "..." }
```

### Sequence diagram (Success Mode)

```
Browser                          Server                         OpenRouter
  |                                |                               |
  |--- GENERATE_REQUEST ---------->|                               |
  |<-- GENERATION_STARTED ---------|                               |
  |<-- CARD_LOADING (card 1) ------|                               |
  |                                |--- generate card 1 ---------->|
  |                                |<-- JSON card 1 ---------------|
  |<-- CARD_READY (card 1) --------|                               |
  |<-- CARD_LOADING (card 2) ------|                               |
  |                                |--- generate card 2 ---------->|
  |                                |<-- JSON card 2 ---------------|
  |<-- CARD_READY (card 2) --------|                               |
  |<-- CARD_LOADING (card 3) ------|                               |
  |                                |--- generate card 3 ---------->|
  |                                |<-- JSON card 3 ---------------|
  |<-- CARD_READY (card 3) --------|                               |
  |<-- GENERATION_COMPLETE --------|                               |
```

Cards are generated **sequentially** on the server — card 2's LLM call does not start until card 1 has been sent to the client. This produces genuine streaming behaviour, not client-side delays.

### Connection lifecycle

- **Heartbeat:** The server pings clients every 30 seconds; unresponsive connections are terminated.
- **Disconnect handling:** If the socket drops mid-generation, the UI shows a connection error instead of hanging silently.
- **Concurrency guard:** A second `GENERATE_REQUEST` while one is in progress is rejected with `SERVER_ERROR`.
- **Rate limiting:** Rapid repeated Generate clicks are throttled (2-second minimum interval per connection).

---

## Failure & Retry Scenario

### How Failure Mode works

Set the **Failure Mode** toggle before clicking Generate. The server still generates cards 1 and 2 normally via OpenRouter. When it reaches card 3, it **deliberately throws a controlled error** in `cardGenerator.ts` — this is intentional and deterministic, not a flaky network or API failure:

```typescript
if (mode === 'failure' && i === 3) {
  throw new Error('Failed to generate card 3. This is a simulated failure...');
}
```

The server emits `CARD_ERROR` for card 3 only. Cards 1 and 2 remain visible and untouched in the UI.

### Retry flow

1. User clicks **Retry** on the failed card 3.
2. Client sends `RETRY_CARD` over the **same WebSocket** (no reconnect).
3. Server emits `CARD_LOADING` for card 3, calls OpenRouter, and **always forces success on retry** regardless of the original mode.
4. Server emits `CARD_READY` then `GENERATION_COMPLETE`.
5. UI shows the success banner: "✅ All 3 cards generated successfully!"

---

## Assumptions & Extra Features

### Scope assumptions

- No database or persistence — cards exist only in client state for the session.
- No authentication — single-user demo scope.
- One active generation per WebSocket connection at a time.
- Message types are manually mirrored between `backend/src/websocket/messageTypes.ts` and `frontend/src/types/messages.ts` (in production, these would live in a shared package).

### Bonus UX features implemented

- **Skeleton shimmer** — animated placeholders for cards awaiting generation.
- **Thinking dots** — per-card pulsing indicator while a card is being generated.
- **Dark / light mode toggle** — persisted in `localStorage`, defaults to system preference.
- **Card entrance animation** — fade + scale-up when a card transitions from loading to ready.
- **Accessibility** — labelled inputs, focus styles, `aria-live` regions for card updates and errors.
- **Responsive layout** — single column on mobile, three-column grid on desktop.
- **Connection indicator** — shows WebSocket connection status in the header.
- **Friendly error copy** — card 3 failure message explains it is a simulated test scenario.

---

## Folder Structure

```
ai-learning-card-generator/
├── README.md
├── .gitignore
├── package.json                 # Root scripts (concurrently dev, install:all, build)
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   └── src/
│       ├── server.ts            # Express + HTTP server bootstrap; attaches WS
│       ├── websocket/
│       │   ├── socketServer.ts  # WS lifecycle, heartbeat, message routing
│       │   └── messageTypes.ts  # Shared TS interfaces for the WS protocol
│       ├── services/
│       │   ├── aiService.ts     # OpenRouter abstraction (swap provider here only)
│       │   └── cardGenerator.ts # Sequential 3-card generation + failure simulation
│       └── utils/
│           └── logger.ts        # Coloured console logger
└── frontend/
    ├── package.json
    ├── tsconfig.json
    ├── .env.example
    └── src/
        ├── main.tsx             # React entry point
        ├── App.tsx              # Layout, theme toggle, wires components to hook
        ├── hooks/
        │   └── useCardSocket.ts # WS connection + generation state machine
        ├── components/
        │   ├── TopicInput.tsx   # Topic input + Generate button
        │   ├── ModeToggle.tsx   # Success / Failure mode switch
        │   ├── CardList.tsx     # Grid of card slots with aria-live
        │   ├── LearningCard.tsx # Ready, error, and idle card states
        │   ├── CardSkeleton.tsx # Shimmer + thinking dots loading state
        │   └── StatusBanner.tsx # Completion / server error banner
        ├── types/
        │   └── messages.ts      # Mirrors backend WS message types
        └── styles/
            └── *.module.css     # CSS Modules for each component
```

---

## What I'd Improve With More Time

- **Shared types package** — extract `messageTypes.ts` into `@app/shared-types` consumed by both frontend and backend to eliminate manual sync.
- **Reconnection with exponential backoff** — auto-reconnect dropped WebSockets and resume or gracefully fail in-flight generations.
- **Automated WS protocol tests** — integration tests that assert the exact message sequence for success, failure, and retry flows.
- **Card history persistence** — save generated cards to localStorage or a database so users can revisit past topics.
- **Provider fallback** — implement an alternate provider adapter behind the same `generateLearningCard` interface with automatic fallback if OpenRouter is unavailable.

---

## Quick Demo Guide

1. Start the app (`npm run dev` from root).
2. Open http://localhost:5173.
3. Enter a topic (e.g. "Photosynthesis") and click **Generate** with **Success Mode** — watch cards fill in one at a time, then see the green completion banner.
4. Switch to **Failure Mode**, generate again — cards 1 and 2 succeed, card 3 shows a red error with **Retry**.
5. Click **Retry** on card 3 — it regenerates over the same socket and the completion banner appears.
