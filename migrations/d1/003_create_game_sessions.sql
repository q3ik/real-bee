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
