-- Migration 002: User progress table for offline sync
-- Created: 2026-04-07

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

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_progress_dedup
  ON user_progress(user_id, timestamp, type);

-- Rollback: DROP TABLE IF EXISTS user_progress;
