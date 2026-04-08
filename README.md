# 🐝 Real Bee

A modern, offline-ready spelling bee game built with React, TypeScript, and Cloudflare. Players spell words letter-by-letter using voice or keyboard input, with progressive hints, TTS pronunciation, and offline persistence.

**Formerly:** `buzzy-game` — this is the consolidated, production-ready successor.

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19 + TypeScript |
| **State** | Zustand (game FSM: `idle` → `playing` → `round_end`) |
| **Styling** | Tailwind CSS v4 |
| **Build** | Vite 6 + Cloudflare Pages |
| **Backend** | Cloudflare Pages Functions (STT/TTS via Gemini API) |
| **Auth** | Supabase (OAuth + anonymous offline fallback) |
| **Offline Storage** | Dexie (IndexedDB) |
| **Voice** | Web Speech API (STT) + Gemini TTS (`gemini-2.5-flash-preview-tts`) via Worker proxy |
| **Error Tracking** | Sentry (`@sentry/react`) |
| **Testing** | Vitest + Testing Library (unit), Playwright (E2E) |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Client (React + Zustand)                           │
│                                                     │
│  App → Onboarding → GameBoard                       │
│              ├── useVoiceRecognition (Web Speech)    │
│              ├── useSpeechSynthesis (Gemini TTS)     │
│              ├── useCountdown (round timer)          │
│              ├── useHints (progressive hints)        │
│              ├── useHostMessages (narration)         │
│              ├── useGameKeyboardShortcuts            │
│              └── useMicrophonePermission             │
│                                                     │
│  Offline: Dexie (IndexedDB) persistence             │
└───────────────────┬─────────────────────────────────┘
                    │ fetch('/api/*')
┌───────────────────▼─────────────────────────────────┐
│  Cloudflare Pages Functions                         │
│                                                     │
│  POST /api/tts → Gemini TTS (gemini-2.5-flash-      │
│                 preview-tts) → base64 audio          │
│  POST /api/stt → Gemini STT (gemini-2.0-flash)      │
│                 → transcribed word                   │
│  POST /api/hint → Gemini hint generation            │
│                                                     │
│  Secrets: GEMINI_API_KEY (wrangler secret put)      │
└─────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 20+
- npm

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your API keys:

| Variable | Description | Required? |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL | Yes (for auth) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key | Yes (for auth) |
| `VITE_SENTRY_DSN` | Sentry DSN for error tracking | No (disabled if not set) |

### 3. Run Locally

```bash
npm run dev
```

The app will start at `http://localhost:5173`.

## Cloudflare Deployment

### Set Secrets

```bash
wrangler secret put GEMINI_API_KEY
wrangler secret put SENTRY_DSN
```

### Deploy

```bash
npm run build
wrangler pages deploy dist --project-name=real-bee
```

Or push to `main` — the GitHub Actions `deploy.yml` workflow handles it automatically.

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run clean` | Remove build output |
| `npm run lint` | TypeScript strict mode check (`tsc --noEmit`) |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:ui` | Run tests with UI |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run dev:functions` | Run Cloudflare functions locally |

## CI/CD

The project uses a tiered GitHub Actions pipeline:

| Workflow | Trigger | Description |
|---|---|---|
| `ci.yml` | PR to `main` | Sanity → lint/test/build |
| `deploy.yml` | Push to `main` | Build + deploy to Cloudflare Pages |
| `ci-config.yml` | Config file changes | Validates package.json, lockfile, workflows |
| `ci-docs.yml` | Docs changes | Markdown validation |

## Project Structure

```
real-bee/
├── src/
│   ├── components/        # React components
│   │   ├── GameBoard.tsx      # Main game screen
│   │   ├── Onboarding.tsx     # Welcome/auth screen
│   │   ├── Settings.tsx       # Settings modal
│   │   ├── HintSystem.tsx     # Progressive hints
│   │   ├── MetricsBar.tsx     # Live score/streak bar
│   │   ├── ErrorBoundary.tsx  # Sentry error boundary
│   │   └── ProgressionOverview.tsx
│   ├── hooks/             # Custom React hooks
│   │   ├── useGameStore.ts          # Zustand game state (FSM)
│   │   ├── useVoiceRecognition.ts   # Web Speech API STT
│   │   ├── useSpeechSynthesis.ts    # Gemini TTS + Web Speech fallback
│   │   ├── useCountdown.ts          # Round timer
│   │   ├── useHints.ts              # Progressive hint generation
│   │   ├── useHostMessages.ts       # Game narration transcript
│   │   ├── useMicrophonePermission.ts
│   │   ├── useOnlineStatus.ts       # Network connectivity
│   │   ├── useScrollLock.ts         # iOS-safe modal scroll lock
│   │   ├── useSessionManager.ts     # Post-session dialog
│   │   ├── useUserPreferences.ts    # Dexie-backed preferences
│   │   ├── useViewport.ts           # Responsive viewport detection
│   │   ├── useKeyboardShortcut.ts   # Generic keyboard shortcut
│   │   ├── useGameKeyboardShortcuts.ts
│   │   └── useDiagnosticsBugReport.ts
│   ├── lib/               # Core utilities
│   │   ├── audioManager.ts    # TTS + SFX singleton
│   │   ├── db.ts              # Dexie (IndexedDB) schema
│   │   ├── sentry.ts          # Sentry initialization
│   │   ├── supabase.ts        # Supabase client
│   │   └── wordList.ts        # Word database + filtering
│   └── main.tsx           # App entry point
├── functions/api/         # Cloudflare Pages Functions
│   ├── tts.ts                 # Gemini TTS proxy
│   ├── stt.ts                 # Gemini STT proxy
│   └── hint.ts                # Gemini hint generation proxy
├── .github/workflows/     # CI/CD pipelines
└── wrangler.toml          # Cloudflare configuration
```

## Game Flow

1. **Onboarding** — Select grade level (K-2, 3-5, 6-8, All) and difficulty (Easy, Medium, Hard, Mixed). Optionally sign in with Supabase.
2. **Game Board** — A word is spoken aloud via TTS. Players spell it using:
   - **Voice** — Web Speech API captures letter-by-letter spelling with NATO phonetic alphabet support
   - **Keyboard** — Type the spelling manually
3. **Hints** — Up to 4 progressive hints (definition → sentence → length → first letter)
4. **Scoring** — Points scale with streak (`10 × streak`). Session stats shown on completion.
5. **Offline Ready** — All progress persists via IndexedDB (Dexie). Game works without internet using Web Speech fallback.
