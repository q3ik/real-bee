import { describe, it, expect, vi, beforeEach } from "vitest";
import { localDb } from "@/lib/db";

describe("game-engine/storage (Dexie integration)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await localDb.progress.clear();
    await localDb.sessions.clear();
    await localDb.preferences.clear();
  });

  describe("LocalUserProgress (uid as primary key)", () => {
    it("put upserts by uid", async () => {
      const uid = `upsert-uid-${Date.now()}`;

      // First put
      await localDb.progress.put({
        uid,
        score: 10,
        streak: 1,
        bestStreak: 1,
        masteredCount: 0,
        gradeLevel: "K-2",
        difficulty: "easy",
        lastPlayed: "2026-04-08T00:00:00.000Z",
        synced: false,
      });

      // Second put (upsert)
      await localDb.progress.put({
        uid,
        score: 200,
        streak: 10,
        bestStreak: 10,
        masteredCount: 5,
        gradeLevel: "3-5",
        difficulty: "hard",
        lastPlayed: "2026-04-09T00:00:00.000Z",
        synced: false,
      });

      // get() uses uid as the primary key
      const result = await localDb.progress.get(uid);
      expect(result).toBeDefined();
      expect(result!.score).toBe(200);
    });

    it("delete removes by uid", async () => {
      const uid = `delete-uid-${Date.now()}`;

      await localDb.progress.put({
        uid,
        score: 50,
        streak: 5,
        bestStreak: 5,
        masteredCount: 2,
        gradeLevel: "6-8",
        difficulty: "medium",
        lastPlayed: "2026-04-08T00:00:00.000Z",
        synced: false,
      });

      await localDb.progress.delete(uid);
      const result = await localDb.progress.get(uid);
      expect(result).toBeUndefined();
    });
  });

  describe("LocalUserPreferences (uid indexed)", () => {
    it("add and query by uid", async () => {
      const uid = `prefs-uid-${Date.now()}`;

      await localDb.preferences.add({
        uid,
        difficulty: "easy",
        gradeLevel: "K-2",
        soundEnabled: true,
        soundVolume: 0.8,
        ttsProvider: "web-speech",
        micEnabled: true,
        theme: "light",
        autoSubmit: false,
        showWelcomeScreen: true,
        dontShowWelcomeAgain: false,
      });

      const result = await localDb.preferences.where("uid").equals(uid).first();
      expect(result).toBeDefined();
      expect(result!.soundEnabled).toBe(true);
    });
  });

  describe("LocalSession (auto-increment id)", () => {
    it("add returns auto-increment id", async () => {
      const id = await localDb.sessions.add({
        uid: `session-uid-${Date.now()}`,
        startTime: "2026-04-08T00:00:00.000Z",
        wordsSpelled: 10,
        correctCount: 8,
        difficultyEvolution: [1, -1, 1],
        synced: false,
      });

      expect(id).toBeDefined();
      expect(typeof id).toBe("number");
    });
  });
});
