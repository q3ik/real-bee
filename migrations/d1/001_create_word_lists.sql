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
