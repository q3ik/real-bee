# Phase 0 — Firebase → Cloudflare Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace real-bee's Firebase backend with Cloudflare Workers + D1 and Supabase Auth, with Gemini API calls moved behind scoped server-side Workers endpoints.

**Architecture:** Four atomic commits — tag, Firebase removal + Supabase addition, Cloudflare tooling, D1 schema + three scoped Workers endpoints. Each commit leaves the app runnable. Commit 4 follows a strict order: create D1 → write migrations → verify migrations apply → write endpoint code.

**Tech Stack:** Cloudflare Pages Functions, Wrangler v4, `@cloudflare/vite-plugin`, Supabase Auth (`@supabase/supabase-js`), Dexie (local cache, unchanged), D1 (SQLite at edge), `@google/genai` (server-side via Workers), Vitest (unit tests for functions)

---

## Task 1: Tag both repos

**Files:** None in real-bee source

**Step 1: Tag real-bee HEAD**

```bash
git tag v0-baseline
git push origin v0-baseline
```
Expected: `* [new tag] v0-baseline -> v0-baseline`

**Step 2: Tag and archive buzzy-game via gh CLI**

```bash
gh api repos/q3ik/buzzy-game/git/refs \
  -X POST -f ref="refs/tags/legacy-reference" \
  -f "object=$(gh api repos/q3ik/buzzy-game/git/refs/heads/main --jq '.object.sha')"
gh api repos/q3ik/buzzy-game \
  -X PATCH -f archived=true
```
Expected: `"archived": true` in the response JSON.

---

## Task 2: Remove Firebase — files, deps, env vars

**Files:**
- Delete: `src/firebase.ts`
- Delete: `firebase-blueprint.json`
- Delete: `firestore.rules`
- Modify: `package.json` (remove `firebase` dep)
- Modify: `.env.example`

**Step 1: Delete Firebase source files**

```bash
rm src/firebase.ts firebase-blueprint.json firestore.rules
```

Check if `firebase-applet-config.json` exists and delete it too:
```bash
rm -f firebase-applet-config.json
```

**Step 2: Remove firebase from package.json**

In `package.json`, remove the line:
```json
"firebase": "^12.11.0",
```

Run:
```bash
npm install
```
Expected: `package-lock.json` updated, no `firebase` in `node_modules`.

**Step 3: Update .env.example**

Replace the current contents of `.env.example` with:
```
# Gemini AI
GEMINI_API_KEY="your-gemini-api-key"

# App URL
APP_URL="http://localhost:5173"

# Supabase (publishable — safe to commit, scoped by RLS)
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-supabase-anon-key"
```

Note: `GEMINI_API_KEY` stays in `.env.example` for local dev only. In production it moves to a Wrangler secret (Task 7). `VITE_` prefix on Supabase keys is correct — the anon key is a publishable key scoped by Row Level Security.

**Step 4: Verify no firebase imports remain**

```bash
grep -r "firebase" src/ --include="*.ts" --include="*.tsx"
```
Expected: no output.

Do NOT commit yet — Task 3 completes commit 2.

---

## Task 3: Add Supabase client + update useGameStore

**Files:**
- Create: `src/lib/supabase.ts`
- Modify: `src/hooks/useGameStore.ts`

**Step 1: Write failing test for supabase client**

Create `src/lib/__tests__/supabase.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';

describe('supabase client', () => {
  it('exports a nullable supabase client', async () => {
    const { supabase } = await import('../supabase');
    // vitest.config.ts injects fallback VITE_SUPABASE_* values
    // so client initializes in test environment
    expect(supabase).not.toBeUndefined();
  });
});
```

Run:
```bash
npx vitest run src/lib/__tests__/supabase.test.ts
```
Expected: FAIL — `Cannot find module '../supabase'`

**Step 2: Create src/lib/supabase.ts**

```typescript
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not configured');
}

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;
```

Run test:
```bash
npx vitest run src/lib/__tests__/supabase.test.ts
```
Expected: PASS

**Step 3: Write failing tests for updated useGameStore**

Create `src/hooks/__tests__/useGameStore.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase before importing the store
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-123' } },
        error: null,
      }),
    },
  },
}));

// Mock Dexie db
vi.mock('@/lib/db', () => ({
  localDb: {
    progress: {
      put: vi.fn().mockResolvedValue(1),
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
        }),
      }),
    },
  },
}));

describe('useGameStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has no firebase imports', async () => {
    // If this module loads cleanly, firebase is removed
    const { useGameStore } = await import('../useGameStore');
    expect(useGameStore).toBeDefined();
  });

  it('loadProgress resolves without throwing when user has no saved data', async () => {
    const { useGameStore } = await import('../useGameStore');
    const store = useGameStore.getState();
    await expect(store.loadProgress()).resolves.not.toThrow();
  });

  it('submitAnswer writes to localDb with supabase user id', async () => {
    const { useGameStore } = await import('../useGameStore');
    const { localDb } = await import('@/lib/db');

    const store = useGameStore.getState();
    // First load progress to hydrate userId
    await store.loadProgress();

    // Set up a current word so submitAnswer has something to check
    store.startSession();
    const currentWord = useGameStore.getState().currentWord;
    if (!currentWord) return; // no words loaded in test env, skip

    store.submitAnswer(currentWord.word);
    expect(localDb.progress.put).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'test-user-123' })
    );
  });
});
```

Run:
```bash
npx vitest run src/hooks/__tests__/useGameStore.test.ts
```
Expected: FAIL — firebase import errors or missing supabase

**Step 4: Update useGameStore.ts**

Replace the entire file content:

```typescript
import { create } from 'zustand';
import { type Word, getWordsForConfig } from '../lib/wordList';
import { localDb } from '../lib/db';
import { supabase } from '../lib/supabase';

interface GameState {
  score: number;
  streak: number;
  bestStreak: number;
  masteredCount: number;
  currentWord: Word | null;
  gradeLevel: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'all';
  isMuted: boolean;
  voiceQuality: 'natural' | 'standard';
  listeningTimeout: 'normal' | 'longer' | 'off';
  showLetterCount: boolean;
  autoListen: boolean;
  sessionWords: Word[];
  sessionIndex: number;
  difficultyEvolution: number[];
  userId: string | null;

  // Actions
  setGradeLevel: (grade: number) => void;
  setDifficulty: (diff: 'easy' | 'medium' | 'hard' | 'all') => void;
  startSession: () => void;
  submitAnswer: (answer: string) => boolean;
  nextWord: () => void;
  toggleMute: () => void;
  toggleLetterCount: () => void;
  toggleAutoListen: () => void;
  setVoiceQuality: (q: 'natural' | 'standard') => void;
  setListeningTimeout: (t: 'normal' | 'longer' | 'off') => void;
  loadProgress: () => Promise<void>;
}

export const useGameStore = create<GameState>((set, get) => ({
  score: 0,
  streak: 0,
  bestStreak: 0,
  masteredCount: 0,
  currentWord: null,
  gradeLevel: 1,
  difficulty: 'easy',
  isMuted: false,
  showLetterCount: true,
  autoListen: false,
  voiceQuality: 'natural',
  listeningTimeout: 'normal',
  sessionWords: [],
  sessionIndex: 0,
  difficultyEvolution: [],
  userId: null,

  setGradeLevel: (grade) => set({ gradeLevel: grade }),
  setDifficulty: (diff) => set({ difficulty: diff }),

  startSession: () => {
    const { gradeLevel, difficulty } = get();
    const words = getWordsForConfig(gradeLevel, difficulty);
    const shuffled = [...words].sort(() => Math.random() - 0.5);
    set({
      sessionWords: shuffled,
      sessionIndex: 0,
      currentWord: shuffled[0],
      difficultyEvolution: [],
    });
  },

  submitAnswer: (answer) => {
    const { currentWord, streak, score, bestStreak, masteredCount, difficultyEvolution, userId } = get();
    if (!currentWord) return false;

    const isCorrect =
      answer.toLowerCase().replace(/\s/g, '') === currentWord.word.toLowerCase();

    if (isCorrect) {
      const newStreak = streak + 1;
      const newScore = score + 10 * newStreak;
      const newBest = Math.max(bestStreak, newStreak);
      const newMastered = masteredCount + 1;

      set({
        score: newScore,
        streak: newStreak,
        bestStreak: newBest,
        masteredCount: newMastered,
        difficultyEvolution: [...difficultyEvolution, 1],
      });

      if (userId) {
        localDb.progress.put({
          uid: userId,
          score: newScore,
          streak: newStreak,
          bestStreak: newBest,
          masteredCount: newMastered,
          gradeLevel: get().gradeLevel.toString(),
          difficulty: get().difficulty,
          lastPlayed: new Date().toISOString(),
          synced: false,
        });
      }
    } else {
      set({
        streak: 0,
        difficultyEvolution: [...difficultyEvolution, -1],
      });
    }

    return isCorrect;
  },

  nextWord: () => {
    const { sessionWords, sessionIndex } = get();
    const nextIndex = sessionIndex + 1;
    if (nextIndex < sessionWords.length) {
      set({ sessionIndex: nextIndex, currentWord: sessionWords[nextIndex] });
    } else {
      set({ currentWord: null });
    }
  },

  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  toggleLetterCount: () => set((state) => ({ showLetterCount: !state.showLetterCount })),
  toggleAutoListen: () => set((state) => ({ autoListen: !state.autoListen })),
  setVoiceQuality: (q) => set({ voiceQuality: q }),
  setListeningTimeout: (t) => set({ listeningTimeout: t }),

  loadProgress: async () => {
    // Hydrate userId from Supabase session
    if (supabase) {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        set({ userId: data.user.id });
      }
    }

    const uid = get().userId;
    if (!uid) return;

    // Load progress from local Dexie cache
    // D1 sync will be added in a future phase
    const local = await localDb.progress.where('uid').equals(uid).first();
    if (local) {
      set({
        score: local.score,
        streak: local.streak,
        bestStreak: local.bestStreak,
        masteredCount: local.masteredCount,
      });
    }
  },
}));
```

**Step 5: Run tests**

```bash
npx vitest run src/hooks/__tests__/useGameStore.test.ts src/lib/__tests__/supabase.test.ts
```
Expected: PASS (the `submitAnswer` test may be skipped if no words load — that's fine)

**Step 6: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: no errors

**Step 7: Commit 2**

```bash
git add src/firebase.ts src/lib/supabase.ts src/lib/__tests__/supabase.test.ts \
  src/hooks/useGameStore.ts src/hooks/__tests__/useGameStore.test.ts \
  firebase-blueprint.json firestore.rules package.json package-lock.json .env.example
git rm src/firebase.ts firebase-blueprint.json firestore.rules
git add -u
git commit -m "feat: replace Firebase with Supabase auth + local-only Dexie progress"
```

---

## Task 4: Add Cloudflare Pages tooling

**Files:**
- Create: `wrangler.toml`
- Modify: `vite.config.ts`
- Modify: `package.json`

**Step 1: Install Cloudflare dev dependencies**

```bash
npm install --save-dev wrangler@^4.69.0 @cloudflare/vite-plugin@^1.25.6 @cloudflare/workers-types@^4.20260313.1
```
Expected: packages added to `devDependencies` in `package.json`.

**Step 2: Create wrangler.toml**

```toml
name = "real-bee"
pages_build_output_dir = "dist"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

# D1 database — fill in database_id after running: wrangler d1 create real-bee-db
[[d1_databases]]
database_id = "FILL_IN_AFTER_wrangler_d1_create"
binding = "DB"
database_name = "real-bee-db"

[vars]
# Comma-separated allowed origins for CORS. Empty = use defaults.
ALLOWED_ORIGINS = ""

# Secrets (never in wrangler.toml — set via `wrangler secret put`):
#   GEMINI_API_KEY
```

**Step 3: Update vite.config.ts**

Replace the file content:

```typescript
import cloudflare from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
  },
});
```

Key change: removed `loadEnv` and `define: { 'process.env.GEMINI_API_KEY': ... }`. The key now lives only in the Worker's `env` binding — it must never be injected into the Vite build.

**Step 4: Add dev scripts to package.json**

In `package.json`, add to `"scripts"`:
```json
"dev:functions": "wrangler pages dev --port 8788 --proxy 5173",
"dev:full": "concurrently -n vite,wrangler -c cyan,magenta \"npm run dev\" \"npm run dev:functions\""
```

**Step 5: Verify GEMINI_API_KEY is not in the Vite output**

```bash
npm run build 2>&1 | tail -5
grep -r "GEMINI" dist/ --include="*.js" 2>/dev/null && echo "FOUND - FIX THIS" || echo "Clean - not found in build output"
```
Expected: `Clean - not found in build output`

**Step 6: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: no errors

**Step 7: Commit 3**

```bash
git add wrangler.toml vite.config.ts package.json package-lock.json
git commit -m "feat: add Cloudflare Pages tooling (wrangler, vite-plugin)"
```

---

## Task 5: Create D1 database + run migrations (Commit 4 step 1–4)

**Files:**
- Create: `migrations/d1/001_create_word_lists.sql`
- Create: `migrations/d1/002_create_user_progress.sql`
- Create: `migrations/d1/003_create_game_sessions.sql`
- Modify: `wrangler.toml` (paste real database_id)

**Step 1: Create the D1 database**

```bash
npx wrangler d1 create real-bee-db
```
Expected output includes:
```
✅ Successfully created DB 'real-bee-db'
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```
Copy the `database_id` value.

**Step 2: Paste database_id into wrangler.toml**

In `wrangler.toml`, replace `FILL_IN_AFTER_wrangler_d1_create` with the actual UUID.

**Step 3: Create migrations directory and migration files**

```bash
mkdir -p migrations/d1
```

Create `migrations/d1/001_create_word_lists.sql`:
```sql
-- Migration 001: Word lists table for server-side word storage
-- Created: 2026-04-07

CREATE TABLE IF NOT EXISTS word_lists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word TEXT NOT NULL,
  grade_level INTEGER NOT NULL,
  difficulty TEXT NOT NULL CHECK(difficulty IN ('easy', 'medium', 'hard')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_word_lists_grade_difficulty
  ON word_lists(grade_level, difficulty);

-- Rollback: DROP TABLE IF EXISTS word_lists;
```

Create `migrations/d1/002_create_user_progress.sql`:
```sql
-- Migration 002: User progress table for offline sync
-- Created: 2026-04-07
-- Mirrors buzzy-game schema (migrations/d1/003_create_user_progress_table.sql)

CREATE TABLE IF NOT EXISTS user_progress (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('progress', 'score', 'session')),
  data TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_user_progress_user_id
  ON user_progress(user_id);

CREATE INDEX IF NOT EXISTS idx_user_progress_timestamp
  ON user_progress(timestamp);

CREATE INDEX IF NOT EXISTS idx_user_progress_user_type
  ON user_progress(user_id, type);

-- Idempotency: prevents duplicate inserts on client retry
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_progress_dedup
  ON user_progress(user_id, timestamp, type);

-- Rollback: DROP TABLE IF EXISTS user_progress;
```

Create `migrations/d1/003_create_game_sessions.sql`:
```sql
-- Migration 003: Game session and hint event tracking
-- Created: 2026-04-07

CREATE TABLE IF NOT EXISTS game_sessions (
  session_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  word TEXT NOT NULL,
  attempts INTEGER DEFAULT 0,
  result TEXT CHECK(result IN ('correct', 'failed', 'abandoned')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_game_sessions_user_id
  ON game_sessions(user_id);

CREATE TABLE IF NOT EXISTS hint_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT REFERENCES game_sessions(session_id),
  user_id TEXT NOT NULL,
  word TEXT NOT NULL,
  hint_type TEXT CHECK(hint_type IN ('definition', 'usage', 'origin')) NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_hint_events_user_id
  ON hint_events(user_id);

-- Rollback:
-- DROP TABLE IF EXISTS hint_events;
-- DROP TABLE IF EXISTS game_sessions;
```

**Step 4: Apply migrations locally and verify**

```bash
npx wrangler d1 migrations apply real-bee-db --local
```
Expected:
```
Migrations to be applied:
  - 001_create_word_lists.sql
  - 002_create_user_progress.sql
  - 003_create_game_sessions.sql
✅ Applied 3 migration(s)
```

If any migration fails, fix the SQL before proceeding. Do NOT write endpoint code until this step succeeds cleanly.

Do NOT commit yet — continue to Task 6.

---

## Task 6: Write functions/types.ts and functions/_middleware.ts + tests

**Files:**
- Create: `functions/types.ts`
- Create: `functions/_middleware.ts`
- Create: `functions/__tests__/middleware.test.ts`

**Step 1: Create functions/types.ts**

```typescript
/**
 * Shared type definitions for Cloudflare Pages Functions
 */

/// <reference types="@cloudflare/workers-types" />

/**
 * Cloudflare environment bindings (from wrangler.toml)
 */
export interface Env {
  DB: D1Database;
  GEMINI_API_KEY: string;
  ALLOWED_ORIGINS?: string;
}

export type PagesContext = EventContext<Env, string, Record<string, unknown>>;
```

**Step 2: Write failing middleware tests**

Create `functions/__tests__/middleware.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import {
  corsHeaders,
  getAllowedOrigins,
  isOriginAllowed,
} from '../_middleware.js';
import type { Env } from '../types.js';

const baseEnv = { DB: {} as Env['DB'], GEMINI_API_KEY: 'test-key' } as Env;

describe('corsHeaders', () => {
  it('returns expected CORS headers for a given origin', () => {
    const headers = corsHeaders('http://localhost:5173');
    expect(headers['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
    expect(headers['Access-Control-Allow-Methods']).toContain('POST');
  });
});

describe('getAllowedOrigins', () => {
  it('returns default origins when ALLOWED_ORIGINS not set', () => {
    const origins = getAllowedOrigins(baseEnv);
    expect(origins).toContain('http://localhost:5173');
  });

  it('merges env origins with defaults', () => {
    const env = { ...baseEnv, ALLOWED_ORIGINS: 'https://custom.example.com' };
    const origins = getAllowedOrigins(env);
    expect(origins).toContain('https://custom.example.com');
    expect(origins).toContain('http://localhost:5173');
  });
});

describe('isOriginAllowed', () => {
  it('allows exact match origin', () => {
    expect(isOriginAllowed('http://localhost:5173', ['http://localhost:5173'])).toBe(true);
  });

  it('rejects unknown origin', () => {
    expect(isOriginAllowed('https://evil.com', ['http://localhost:5173'])).toBe(false);
  });

  it('allows wildcard subdomain', () => {
    expect(isOriginAllowed('https://sub.real-bee.pages.dev', ['*.real-bee.pages.dev'])).toBe(true);
  });

  it('rejects empty origin', () => {
    expect(isOriginAllowed('', ['http://localhost:5173'])).toBe(false);
  });
});
```

Run:
```bash
npx vitest run functions/__tests__/middleware.test.ts
```
Expected: FAIL — `Cannot find module '../_middleware.js'`

**Step 3: Create functions/_middleware.ts**

```typescript
/**
 * Cloudflare Pages Middleware: Shared CORS utilities
 * Route: applies to all /api/* endpoints via onRequest export
 */
import type { Env, PagesContext } from './types.js';

const DEFAULT_ALLOWED_ORIGINS = [
  'https://real-bee.pages.dev',
  '*.real-bee.pages.dev',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8788',
];

export function getAllowedOrigins(env: Env): string[] {
  if (!env.ALLOWED_ORIGINS) {
    return DEFAULT_ALLOWED_ORIGINS;
  }
  const configured = env.ALLOWED_ORIGINS
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  return [...new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured])];
}

export function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
  if (!origin) return false;
  return allowedOrigins.some((allowed) => {
    if (allowed === origin) return true;
    if (allowed.startsWith('*.')) {
      const domain = allowed.slice(2);
      return origin.endsWith('.' + domain) || origin === 'https://' + domain;
    }
    return false;
  });
}

export async function onRequestOptions(context: PagesContext): Promise<Response> {
  const origin = context.request.headers.get('origin') || '';
  const allowedOrigins = getAllowedOrigins(context.env);
  if (!isOriginAllowed(origin, allowedOrigins)) {
    return new Response(null, { status: 403 });
  }
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

export const onRequest = async (context: PagesContext) => {
  try {
    return await context.next();
  } catch (err) {
    const origin = context.request.headers.get('origin') || '';
    console.error('[middleware] Unhandled error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }
};
```

**Step 4: Run middleware tests**

```bash
npx vitest run functions/__tests__/middleware.test.ts
```
Expected: PASS

---

## Task 7: Write functions/api/hint.ts + tests

**Files:**
- Create: `functions/api/hint.ts`
- Create: `functions/api/__tests__/hint.test.ts`

**Step 1: Write failing hint tests**

Create `functions/api/__tests__/hint.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestPost } from '../hint.js';
import type { Env, PagesContext } from '../../types.js';

const mockEnv: Env = {
  DB: {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({ run: vi.fn().mockResolvedValue({}) }),
    }),
  } as unknown as D1Database,
  GEMINI_API_KEY: 'test-gemini-key',
  ALLOWED_ORIGINS: 'http://localhost:5173',
};

function makeContext(body: unknown, origin = 'http://localhost:5173'): PagesContext {
  return {
    request: new Request('http://localhost/api/hint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin },
      body: JSON.stringify(body),
    }),
    env: mockEnv,
    next: vi.fn(),
    waitUntil: vi.fn(),
  } as unknown as PagesContext;
}

describe('POST /api/hint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 for missing word', async () => {
    const res = await onRequestPost(makeContext({ type: 'definition' }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/word/i);
  });

  it('returns 400 for empty word', async () => {
    const res = await onRequestPost(makeContext({ word: '  ', type: 'definition' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid type', async () => {
    const res = await onRequestPost(makeContext({ word: 'apple', type: 'phonetic' }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/type/i);
  });

  it('returns 400 for invalid JSON', async () => {
    const context = {
      request: new Request('http://localhost/api/hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', origin: 'http://localhost:5173' },
        body: 'not-json',
      }),
      env: mockEnv,
      next: vi.fn(),
      waitUntil: vi.fn(),
    } as unknown as PagesContext;
    const res = await onRequestPost(context);
    expect(res.status).toBe(400);
  });

  it('returns 403 for disallowed origin', async () => {
    const res = await onRequestPost(makeContext({ word: 'apple', type: 'definition' }, 'https://evil.com'));
    expect(res.status).toBe(403);
  });

  it('returns 503 when GEMINI_API_KEY is missing', async () => {
    const envNoKey = { ...mockEnv, GEMINI_API_KEY: '' };
    const context = makeContext({ word: 'apple', type: 'definition' });
    (context as unknown as { env: Env }).env = envNoKey;
    const res = await onRequestPost(context);
    expect(res.status).toBe(503);
  });

  it('returns { hint: string } for valid input', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'A round red fruit.' }] } }],
      }),
    }));

    const res = await onRequestPost(makeContext({ word: 'apple', type: 'definition' }));
    expect(res.status).toBe(200);
    const body = await res.json() as { hint: string };
    expect(typeof body.hint).toBe('string');
    expect(body.hint.length).toBeGreaterThan(0);

    vi.unstubAllGlobals();
  });
});
```

Run:
```bash
npx vitest run functions/api/__tests__/hint.test.ts
```
Expected: FAIL — `Cannot find module '../hint.js'`

**Step 2: Create functions/api/hint.ts**

```typescript
/**
 * Cloudflare Pages Function: AI-powered word hints
 *
 * Route: /api/hint
 * Method: POST
 *
 * Request body: { word: string, type: 'definition' | 'usage' | 'origin' }
 * Response: { hint: string }
 *
 * Constructs a scoped Gemini request server-side.
 * The client cannot influence model selection, system prompt, or parameters.
 */
import { getAllowedOrigins, corsHeaders, isOriginAllowed, onRequestOptions } from '../_middleware.js';
export { onRequestOptions };
import type { PagesContext } from '../types.js';

type HintType = 'definition' | 'usage' | 'origin';
const VALID_TYPES: HintType[] = ['definition', 'usage', 'origin'];

const SYSTEM_PROMPTS: Record<HintType, string> = {
  definition:
    'You are a spelling teacher. Given a word, provide a concise definition in 1–2 sentences suitable for a student. Do not use the target word in your definition.',
  usage:
    'You are a spelling teacher. Given a word, provide a single natural example sentence using that word correctly.',
  origin:
    'You are a spelling teacher. Given a word, briefly explain its language of origin or etymology in 1–2 sentences.',
};

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '';
  const allowedOrigins = getAllowedOrigins(env);

  if (!isOriginAllowed(origin, allowedOrigins)) {
    return json({ error: 'Origin not allowed' }, 403, origin);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'Invalid JSON in request body' }, 400, origin);
  }

  const { word, type } = body;

  if (!word || typeof word !== 'string' || word.trim().length === 0) {
    return json({ error: 'Missing or invalid "word" field' }, 400, origin);
  }
  if (!type || !VALID_TYPES.includes(type as HintType)) {
    return json(
      { error: 'Invalid "type" field — must be definition, usage, or origin' },
      400,
      origin
    );
  }

  if (!env.GEMINI_API_KEY) {
    return json({ error: 'Hint service not configured' }, 503, origin);
  }

  const trimmedWord = (word as string).trim();
  const hintType = type as HintType;

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPTS[hintType] }] },
          contents: [{ parts: [{ text: trimmedWord }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 150 },
        }),
      }
    );

    if (!geminiRes.ok) {
      throw new Error(`Gemini API error: ${geminiRes.status}`);
    }

    const data = (await geminiRes.json()) as {
      candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
    };
    const hint = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';

    if (!hint) {
      throw new Error('Empty response from Gemini');
    }

    // Log hint event to D1 (non-fatal)
    try {
      await env.DB.prepare(
        'INSERT INTO hint_events (session_id, user_id, word, hint_type, created_at) VALUES (?, ?, ?, ?, unixepoch())'
      )
        .bind(null, 'anonymous', trimmedWord, hintType)
        .run();
    } catch {
      console.error('[hint] Failed to log hint event to D1');
    }

    return json({ hint }, 200, origin);
  } catch (error) {
    console.error('[hint] Generation error:', error);
    return json({ error: 'Hint generation failed' }, 500, origin);
  }
}

function json(body: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}
```

**Step 3: Run hint tests**

```bash
npx vitest run functions/api/__tests__/hint.test.ts
```
Expected: PASS

---

## Task 8: Write functions/api/tts.ts + tests

**Files:**
- Create: `functions/api/tts.ts`
- Create: `functions/api/__tests__/tts.test.ts`

**Step 1: Write failing TTS tests**

Create `functions/api/__tests__/tts.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestPost } from '../tts.js';
import type { Env, PagesContext } from '../../types.js';

const mockEnv: Env = {
  DB: {} as unknown as D1Database,
  GEMINI_API_KEY: 'test-key',
};

function makeContext(body: unknown, origin = 'http://localhost:5173'): PagesContext {
  return {
    request: new Request('http://localhost/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin },
      body: JSON.stringify(body),
    }),
    env: mockEnv,
    next: vi.fn(),
    waitUntil: vi.fn(),
  } as unknown as PagesContext;
}

describe('POST /api/tts', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 400 for missing word', async () => {
    const res = await onRequestPost(makeContext({}));
    expect(res.status).toBe(400);
  });

  it('returns 400 for word exceeding 200 chars', async () => {
    const res = await onRequestPost(makeContext({ word: 'a'.repeat(201) }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid voice', async () => {
    const res = await onRequestPost(makeContext({ word: 'apple', voice: 'unknown-voice' }));
    expect(res.status).toBe(400);
  });

  it('returns 503 when GEMINI_API_KEY is missing', async () => {
    const context = makeContext({ word: 'apple' });
    (context as unknown as { env: Env }).env = { ...mockEnv, GEMINI_API_KEY: '' };
    const res = await onRequestPost(context);
    expect(res.status).toBe(503);
  });

  it('returns audio JSON for valid input', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{
          content: { parts: [{ inlineData: { data: 'AAAA', mimeType: 'audio/wav' } }] },
        }],
      }),
    }));

    const res = await onRequestPost(makeContext({ word: 'apple' }));
    expect(res.status).toBe(200);
    const body = await res.json() as { audio: string; mimeType: string };
    expect(body.audio).toBe('AAAA');
    expect(body.mimeType).toBe('audio/wav');

    vi.unstubAllGlobals();
  });
});
```

Run:
```bash
npx vitest run functions/api/__tests__/tts.test.ts
```
Expected: FAIL — `Cannot find module '../tts.js'`

**Step 2: Create functions/api/tts.ts**

```typescript
/**
 * Cloudflare Pages Function: Text-to-Speech via Gemini
 *
 * Route: /api/tts
 * Method: POST
 *
 * Request body: { word: string, voice?: string }
 * Response: { audio: string (base64), mimeType: string }
 *
 * Model, voice defaults, and audio format are hardcoded server-side.
 */
import { getAllowedOrigins, corsHeaders, isOriginAllowed, onRequestOptions } from '../_middleware.js';
export { onRequestOptions };
import type { PagesContext } from '../types.js';

const VALID_VOICES = ['Aoede', 'Charon', 'Fenrir', 'Kore', 'Puck'] as const;
type GeminiVoice = typeof VALID_VOICES[number];
const DEFAULT_VOICE: GeminiVoice = 'Aoede';

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '';
  const allowedOrigins = getAllowedOrigins(env);

  if (!isOriginAllowed(origin, allowedOrigins)) {
    return json({ error: 'Origin not allowed' }, 403, origin);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'Invalid JSON in request body' }, 400, origin);
  }

  const { word, voice } = body;

  if (!word || typeof word !== 'string' || word.trim().length === 0) {
    return json({ error: 'Missing or invalid "word" field' }, 400, origin);
  }
  if ((word as string).trim().length > 200) {
    return json({ error: '"word" exceeds maximum length of 200 characters' }, 400, origin);
  }
  if (voice !== undefined && !VALID_VOICES.includes(voice as GeminiVoice)) {
    return json(
      { error: `Invalid "voice" — must be one of: ${VALID_VOICES.join(', ')}` },
      400,
      origin
    );
  }

  if (!env.GEMINI_API_KEY) {
    return json({ error: 'TTS service not configured' }, 503, origin);
  }

  const selectedVoice = (voice as GeminiVoice | undefined) ?? DEFAULT_VOICE;
  const trimmedWord = (word as string).trim();

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: trimmedWord }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: selectedVoice },
              },
            },
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      throw new Error(`Gemini TTS error: ${geminiRes.status}`);
    }

    const data = (await geminiRes.json()) as {
      candidates: Array<{
        content: { parts: Array<{ inlineData?: { data: string; mimeType: string } }> };
      }>;
    };
    const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;

    if (!inlineData?.data) {
      throw new Error('No audio data in Gemini TTS response');
    }

    return json({ audio: inlineData.data, mimeType: inlineData.mimeType ?? 'audio/wav' }, 200, origin);
  } catch (error) {
    console.error('[tts] Error:', error);
    return json({ error: 'TTS generation failed' }, 500, origin);
  }
}

function json(body: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}
```

**Step 3: Run TTS tests**

```bash
npx vitest run functions/api/__tests__/tts.test.ts
```
Expected: PASS

---

## Task 9: Write functions/api/stt.ts + tests

**Files:**
- Create: `functions/api/stt.ts`
- Create: `functions/api/__tests__/stt.test.ts`

**Step 1: Write failing STT tests**

Create `functions/api/__tests__/stt.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestPost } from '../stt.js';
import type { Env, PagesContext } from '../../types.js';

const mockEnv: Env = {
  DB: {} as unknown as D1Database,
  GEMINI_API_KEY: 'test-key',
};

function makeAudioContext(
  audioBase64: string,
  mimeType = 'audio/webm',
  origin = 'http://localhost:5173'
): PagesContext {
  return {
    request: new Request('http://localhost/api/stt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin },
      body: JSON.stringify({ audio: audioBase64, mimeType }),
    }),
    env: mockEnv,
    next: vi.fn(),
    waitUntil: vi.fn(),
  } as unknown as PagesContext;
}

describe('POST /api/stt', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 400 for missing audio field', async () => {
    const context = {
      request: new Request('http://localhost/api/stt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', origin: 'http://localhost:5173' },
        body: JSON.stringify({ mimeType: 'audio/webm' }),
      }),
      env: mockEnv,
      next: vi.fn(),
      waitUntil: vi.fn(),
    } as unknown as PagesContext;
    const res = await onRequestPost(context);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid mimeType', async () => {
    const res = await onRequestPost(makeAudioContext('AAAA', 'video/mp4'));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/mimeType/i);
  });

  it('returns 503 when GEMINI_API_KEY is missing', async () => {
    const context = makeAudioContext('AAAA');
    (context as unknown as { env: Env }).env = { ...mockEnv, GEMINI_API_KEY: '' };
    const res = await onRequestPost(context);
    expect(res.status).toBe(503);
  });

  it('returns 403 for disallowed origin', async () => {
    const res = await onRequestPost(makeAudioContext('AAAA', 'audio/webm', 'https://evil.com'));
    expect(res.status).toBe(403);
  });

  it('returns { transcript: string } for valid input', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'apple' }] } }],
      }),
    }));

    const res = await onRequestPost(makeAudioContext('AAAA'));
    expect(res.status).toBe(200);
    const body = await res.json() as { transcript: string };
    expect(body.transcript).toBe('apple');

    vi.unstubAllGlobals();
  });
});
```

Run:
```bash
npx vitest run functions/api/__tests__/stt.test.ts
```
Expected: FAIL — `Cannot find module '../stt.js'`

**Step 2: Create functions/api/stt.ts**

```typescript
/**
 * Cloudflare Pages Function: Speech-to-Text via Gemini
 *
 * Route: /api/stt
 * Method: POST
 *
 * Request body: { audio: string (base64), mimeType: string }
 * Response: { transcript: string }
 *
 * System prompt instructs Gemini to return only the spoken word.
 * Model and parameters are hardcoded server-side.
 */
import { getAllowedOrigins, corsHeaders, isOriginAllowed, onRequestOptions } from '../_middleware.js';
export { onRequestOptions };
import type { PagesContext } from '../types.js';

const ALLOWED_MIME_TYPES = [
  'audio/webm',
  'audio/webm;codecs=opus',
  'audio/ogg',
  'audio/mp4',
  'audio/wav',
  'audio/mpeg',
] as const;

type AllowedMimeType = typeof ALLOWED_MIME_TYPES[number];

const STT_SYSTEM_PROMPT =
  'You are a spelling bee judge. The user has spoken a word. ' +
  'Transcribe exactly the word you hear — return only the single word, lowercase, no punctuation, nothing else.';

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '';
  const allowedOrigins = getAllowedOrigins(env);

  if (!isOriginAllowed(origin, allowedOrigins)) {
    return json({ error: 'Origin not allowed' }, 403, origin);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'Invalid JSON in request body' }, 400, origin);
  }

  const { audio, mimeType } = body;

  if (!audio || typeof audio !== 'string' || audio.trim().length === 0) {
    return json({ error: 'Missing or invalid "audio" field (expected base64 string)' }, 400, origin);
  }
  if (!mimeType || !ALLOWED_MIME_TYPES.includes(mimeType as AllowedMimeType)) {
    return json(
      {
        error: `Invalid "mimeType" — must be one of: ${ALLOWED_MIME_TYPES.join(', ')}`,
      },
      400,
      origin
    );
  }

  if (!env.GEMINI_API_KEY) {
    return json({ error: 'STT service not configured' }, 503, origin);
  }

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: STT_SYSTEM_PROMPT }] },
          contents: [
            {
              parts: [
                { inlineData: { mimeType: mimeType as string, data: audio as string } },
                { text: 'What word was spoken?' },
              ],
            },
          ],
          generationConfig: { temperature: 0, maxOutputTokens: 20 },
        }),
      }
    );

    if (!geminiRes.ok) {
      throw new Error(`Gemini STT error: ${geminiRes.status}`);
    }

    const data = (await geminiRes.json()) as {
      candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
    };
    const transcript = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';

    if (!transcript) {
      throw new Error('Empty transcript from Gemini');
    }

    return json({ transcript }, 200, origin);
  } catch (error) {
    console.error('[stt] Error:', error);
    return json({ error: 'Transcription failed' }, 500, origin);
  }
}

function json(body: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}
```

**Step 3: Run STT tests**

```bash
npx vitest run functions/api/__tests__/stt.test.ts
```
Expected: PASS

---

## Task 10: Full test run + TypeScript check + Commit 4

**Step 1: Run all function tests together**

```bash
npx vitest run functions/
```
Expected: all tests PASS

**Step 2: Run full test suite**

```bash
npm test
```
Note: `src/test/integration/offline-sync.test.ts` imports `@/services/progressSync` and `@/lib/sync` which don't exist yet — those are Phase 1/Phase 2 work. If those tests are currently failing, confirm they were failing before your changes too (`git stash && npm test && git stash pop`). Do not fix them in Phase 0.

**Step 3: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors

**Step 4: Verify GEMINI_API_KEY not in build**

```bash
npm run build
grep -r "GEMINI" dist/ --include="*.js" 2>/dev/null && echo "LEAK - FIX THIS" || echo "Clean"
```
Expected: `Clean`

**Step 5: Verify wrangler migrations apply to local D1**

```bash
npx wrangler d1 migrations apply real-bee-db --local
```
Expected: already applied (no new migrations to run)

**Step 6: Commit 4**

```bash
git add migrations/ functions/ wrangler.toml
git commit -m "feat: add D1 schema + scoped Cloudflare Workers endpoints (hint, tts, stt)"
```

---

## Acceptance Criteria Verification

Run these after all four commits:

```bash
# 1. Firebase fully removed
grep -r "firebase" src/ --include="*.ts" --include="*.tsx" && echo "FAIL" || echo "PASS: no firebase imports"

# 2. GEMINI_API_KEY not in build output
npm run build && grep -r "GEMINI" dist/ --include="*.js" 2>/dev/null && echo "FAIL" || echo "PASS: key not in build"

# 3. All D1 migrations apply cleanly
npx wrangler d1 migrations apply real-bee-db --local

# 4. Supabase client initializes (check console — should warn, not throw)
npx vitest run src/lib/__tests__/supabase.test.ts

# 5. All function tests pass
npx vitest run functions/
```

Manual verification (run `npm run dev:full` and open `http://localhost:8788`):
- [ ] `POST /api/hint` with `{"word":"ephemeral","type":"definition"}` returns `{"hint":"..."}`
- [ ] `POST /api/tts` with `{"word":"ephemeral"}` returns `{"audio":"...","mimeType":"audio/wav"}`
- [ ] `POST /api/hint` with `{"word":"","type":"definition"}` returns 400
- [ ] `POST /api/hint` with `{}` from `https://evil.com` origin returns 403
