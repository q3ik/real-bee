import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSpeechSynthesis } from "../useSpeechSynthesis";
import * as audioManagerModule from "../../lib/audioManager";

// Mock audioManager
const mockSpeak = vi.fn().mockResolvedValue(undefined);
vi.mock("../../lib/audioManager", () => ({
  audioManager: {
    speak: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("useSpeechSynthesis", () => {
  const mockAddMessage = vi.fn();
  const mockOnError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("initialization", () => {
    it("should initialize with TTS supported", () => {
      const { result } = renderHook(() =>
        useSpeechSynthesis({ addMessage: mockAddMessage, soundEnabled: true }),
      );

      expect(result.current.ttsSupported).toBe(true);
    });

    it("should provide speak, repeatWord, giveSentence, giveDefinition, giveHint", () => {
      const { result } = renderHook(() =>
        useSpeechSynthesis({ addMessage: mockAddMessage, soundEnabled: true }),
      );

      expect(typeof result.current.speak).toBe("function");
      expect(typeof result.current.repeatWord).toBe("function");
      expect(typeof result.current.giveSentence).toBe("function");
      expect(typeof result.current.giveDefinition).toBe("function");
      expect(typeof result.current.giveHint).toBe("function");
    });
  });

  describe("speak()", () => {
    it("should call audioManager.speak with the text", async () => {
      const { audioManager } = await import("../../lib/audioManager");
      const mockSpeak = vi.mocked(audioManager.speak);
      mockSpeak.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() =>
        useSpeechSynthesis({ addMessage: mockAddMessage, soundEnabled: true }),
      );

      await act(async () => {
        await result.current.speak("hello");
      });

      expect(mockSpeak).toHaveBeenCalledWith("hello");
    });

    it("should execute callback when playback completes", async () => {
      const { audioManager } = await import("../../lib/audioManager");
      vi.mocked(audioManager.speak).mockResolvedValueOnce(undefined);

      const callback = vi.fn();
      const { result } = renderHook(() =>
        useSpeechSynthesis({ addMessage: mockAddMessage, soundEnabled: true }),
      );

      await act(async () => {
        await result.current.speak("hello", callback);
      });

      expect(callback).toHaveBeenCalled();
    });

    it("should skip playback when soundEnabled is false", async () => {
      const callback = vi.fn();

      const { result } = renderHook(() =>
        useSpeechSynthesis({ addMessage: mockAddMessage, soundEnabled: false }),
      );

      await act(async () => {
        await result.current.speak("hello", callback);
      });

      const { audioManager } = await import("../../lib/audioManager");
      expect(audioManager.speak).not.toHaveBeenCalled();
      expect(callback).toHaveBeenCalled();
    });

    it("should skip when text is empty", async () => {
      const callback = vi.fn();

      const { result } = renderHook(() =>
        useSpeechSynthesis({ addMessage: mockAddMessage, soundEnabled: true }),
      );

      await act(async () => {
        await result.current.speak("", callback);
      });

      const { audioManager } = await import("../../lib/audioManager");
      expect(audioManager.speak).not.toHaveBeenCalled();
      expect(callback).toHaveBeenCalled();
    });

    it("should call onError when audioManager.speak throws", async () => {
      const { audioManager } = await import("../../lib/audioManager");
      vi.mocked(audioManager.speak).mockRejectedValueOnce(
        new Error("TTS failed"),
      );

      const { result } = renderHook(() =>
        useSpeechSynthesis({
          addMessage: mockAddMessage,
          soundEnabled: true,
          onError: mockOnError,
        }),
      );

      await act(async () => {
        await result.current.speak("hello");
      });

      expect(mockOnError).toHaveBeenCalledWith(
        "Text-to-speech is unavailable right now.",
      );
    });
  });

  describe("repeatWord()", () => {
    it("should add message and speak word", async () => {
      const { audioManager } = await import("../../lib/audioManager");
      vi.mocked(audioManager.speak).mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useSpeechSynthesis({ addMessage: mockAddMessage, soundEnabled: true }),
      );

      await act(async () => {
        await result.current.repeatWord("hello");
      });

      expect(mockAddMessage).toHaveBeenCalledWith(
        "word",
        "Repeating: [hidden]",
      );
      expect(audioManager.speak).toHaveBeenCalledWith("Your word is: hello");
    });
  });

  describe("giveSentence()", () => {
    it("should add message and speak sentence", async () => {
      const { audioManager } = await import("../../lib/audioManager");
      vi.mocked(audioManager.speak).mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useSpeechSynthesis({ addMessage: mockAddMessage, soundEnabled: true }),
      );

      await act(async () => {
        await result.current.giveSentence("This is a test sentence.");
      });

      expect(mockAddMessage).toHaveBeenCalledWith(
        "sentence",
        "This is a test sentence.",
      );
      expect(audioManager.speak).toHaveBeenCalledWith(
        "This is a test sentence.",
      );
    });
  });

  describe("giveDefinition()", () => {
    it("should add message and speak definition", async () => {
      const { audioManager } = await import("../../lib/audioManager");
      vi.mocked(audioManager.speak).mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useSpeechSynthesis({ addMessage: mockAddMessage, soundEnabled: true }),
      );

      await act(async () => {
        await result.current.giveDefinition("a word definition");
      });

      expect(mockAddMessage).toHaveBeenCalledWith(
        "definition",
        "The definition is: a word definition",
      );
      expect(audioManager.speak).toHaveBeenCalledWith("a word definition");
    });
  });

  describe("giveHint()", () => {
    it("should add message and speak hint", async () => {
      const { audioManager } = await import("../../lib/audioManager");
      vi.mocked(audioManager.speak).mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useSpeechSynthesis({ addMessage: mockAddMessage, soundEnabled: true }),
      );

      await act(async () => {
        await result.current.giveHint("Hint: starts with H");
      });

      expect(mockAddMessage).toHaveBeenCalledWith(
        "system",
        "Hint: starts with H",
      );
      expect(audioManager.speak).toHaveBeenCalledWith("Hint: starts with H");
    });
  });
});
