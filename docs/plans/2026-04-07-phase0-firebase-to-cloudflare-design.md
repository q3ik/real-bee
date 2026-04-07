---
title: Phase 0 — Freeze, Tag & Backend Swap (Firebase → Cloudflare)
date: 2026-04-07
issue: https://github.com/q3ik/real-bee/issues/2
parent: https://github.com/q3ik/real-bee/issues/1
---

## Goal

Establish a clean starting point for `real-bee` by replacing its Firebase backend with Cloudflare Workers + D1 before any feature work begins. Firebase is fully removed; Supabase Auth replaces Firebase Auth; Gemini API calls move server-side behind scoped Cloudflare Pages Functions.

## Approach

Option B: parallel removal + addition. Each commit leaves the app in a runnable state. No commit removes a dependency without adding its replacement in the same pass.

---

## Commit Sequence

### Commit 1 — Tag both repos (task 0.1)

Tag `real-bee` HEAD as `v0-baseline`, tag `buzzy-game` as `legacy-reference`, archive `buzzy-game` on GitHub (read-only).

No file changes in `real-bee`.

---

### Commit 2 — Remove Firebase, add Supabase (tasks 0.2 + 0.4)

**Removals:**
- `firebase` from `package.json` dependencies
- `src/firebase.ts`
- `firebase-blueprint.json`, `firestore.rules`, `firebase-applet-config.json` (root-level Firebase artifacts)
- Firebase env vars from `.env.example`

**Additions:**
- `@supabase/supabase-js` to `dependencies`
- `src/lib/supabase.ts` — creates a nullable `SupabaseClient`; reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from `import.meta.env`; warns if not configured (mirrors `buzzy-game` pattern)
- `.env.example` entries: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

**Modified:**
- `src/hooks/useGameStore.ts` — replace `auth.currentUser` with `supabase?.auth.getUser()`; remove all Firestore imports (`doc`, `setDoc`, `getDoc`); `loadProgress` reads from Dexie only (D1 sync added in Commit 4); `submitAnswer` writes to Dexie using `user.id` from Supabase session

**Note:** `VITE_` prefix on Supabase keys is correct. The anon key is a publishable key scoped by Row Level Security, not a secret.

---

### Commit 3 — Cloudflare Pages tooling (task 0.3)

**Package changes (`devDependencies`):**
- `wrangler` (version matching `buzzy-game`: `^4.69.0`)
- `@cloudflare/vite-plugin` (`^1.25.6`)
- `@cloudflare/workers-types` (`^4.20260313.1`)

**New files:**
- `wrangler.toml` — `name = "real-bee"`, `pages_build_output_dir = "dist"`, `compatibility_date = "2024-01-01"`, `compatibility_flags = ["nodejs_compat"]`, D1 binding placeholder (ID filled in Commit 4), `GEMINI_API_KEY` secret binding, `ALLOWED_ORIGINS` var

**Modified:**
- `vite.config.ts` — add `cloudflare()` plugin from `@cloudflare/vite-plugin`; remove `define: { 'process.env.GEMINI_API_KEY': ... }` (key moves server-side, must not be injected at build time)
- `package.json` scripts — add `"dev:functions": "wrangler pages dev --port 8788 --proxy 5173"` and `"dev:full": "concurrently -n vite,wrangler -c cyan,magenta \"npm run dev\" \"npm run dev:functions\""`

---

### Commit 4 — D1 schema + three scoped Workers endpoints (tasks 0.5 + 0.6)

**Strict execution order — do not deviate:**

1. Run `wrangler d1 create real-bee-db` → copy the returned database ID
2. Paste ID into `wrangler.toml` D1 binding
3. Write all three migration files
4. Run `wrangler d1 migrations apply real-bee-db --local` → confirm clean apply
5. Only after migrations succeed: write endpoint code

**Migration files:**

`migrations/d1/001_create_word_lists.sql`
- `word_lists` table: `id`, `word`, `grade_level`, `difficulty`, `created_at`

`migrations/d1/002_create_user_progress.sql`
- `user_progress` table (mirrors `buzzy-game` schema): `id TEXT PRIMARY KEY`, `user_id TEXT`, `type TEXT CHECK(type IN ('progress', 'score', 'session'))`, `data TEXT`, `timestamp TEXT`, `created_at TEXT DEFAULT (datetime('now'))`
- Indexes: `idx_user_progress_user_id`, `idx_user_progress_timestamp`, `idx_user_progress_user_type`
- Unique index for idempotency: `(user_id, timestamp, type)`

`migrations/d1/003_create_game_sessions.sql`
```sql
CREATE TABLE IF NOT EXISTS game_sessions (
  session_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  word TEXT NOT NULL,
  attempts INTEGER DEFAULT 0,
  result TEXT CHECK(result IN ('correct', 'failed', 'abandoned')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS hint_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT REFERENCES game_sessions(session_id),
  user_id TEXT NOT NULL,
  word TEXT NOT NULL,
  hint_type TEXT CHECK(hint_type IN ('definition', 'usage', 'origin')) NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

**New files (written only after migrations verify clean):**

`functions/types.ts`
- `Env` interface: `DB: D1Database`, `GEMINI_API_KEY: string`, `ALLOWED_ORIGINS?: string`
- `PagesContext` type alias

`functions/_middleware.ts`
- CORS preflight handler (port from `buzzy-game`, update `DEFAULT_ALLOWED_ORIGINS` for `real-bee`)
- Exports: `corsHeaders`, `getAllowedOrigins`, `isOriginAllowed`, `onRequestOptions`
- No Sentry (not in scope for Phase 0)

`functions/api/tts.ts`
- Accepts: `{ word: string, voice?: string }`
- Validates: `word` is non-empty string, max 200 chars; `voice` is optional enum
- Constructs: Gemini TTS request server-side (model, voice hardcoded if not provided)
- Returns: audio blob with `Content-Type: audio/mpeg`
- Rejects unknown fields with 400

`functions/api/stt.ts`
- Accepts: audio blob (`Content-Type: audio/*`)
- Validates: content type, max size
- Constructs: Gemini STT request server-side
- Returns: `{ transcript: string }`

`functions/api/hint.ts`
- Accepts: `{ word: string, type: 'definition' | 'usage' | 'origin' }`
- Validates: `word` non-empty, `type` is one of the three allowed values
- Constructs: hardcoded system prompt per `type` (model, temperature, token limit set server-side)
- Returns: `{ hint: string }`
- Logs `hint_events` row to D1 on each request

---

## Acceptance Criteria

- [ ] `npm run dev:full` starts both Vite and Wrangler Pages dev server
- [ ] Firebase is fully removed — no imports, no env vars, no config files
- [ ] Supabase client initializes without errors in local dev (nullable if env vars absent)
- [ ] `GEMINI_API_KEY` is absent from the Vite build output — verify with `grep -r GEMINI dist/`
- [ ] All three D1 migrations apply cleanly via `wrangler d1 migrations apply real-bee-db --local`
- [ ] `POST /api/hint` returns `{ hint: string }` for valid input
- [ ] `POST /api/tts` returns audio for a valid word
- [ ] `POST /api/stt` returns `{ transcript: string }` for valid audio input
- [ ] All three endpoints return 400 for malformed input

---

## Reference

- `buzzy-game` patterns used: `src/lib/supabase.ts`, `functions/types.ts`, `functions/_middleware.ts`, `functions/api/tts.ts`, `wrangler.toml`, dev scripts
- `buzzy-game` D1 schema: `migrations/d1/003_create_user_progress_table.sql`
