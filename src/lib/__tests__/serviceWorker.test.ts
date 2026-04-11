import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  registerServiceWorker,
  unregisterServiceWorker,
} from "../serviceWorker";

describe("Service Worker Registration Helper", () => {
  let originalServiceWorker: ServiceWorkerContainer | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    originalServiceWorker = navigator.serviceWorker;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Restore original navigator.serviceWorker
    Object.defineProperty(navigator, "serviceWorker", {
      value: originalServiceWorker,
      writable: true,
      configurable: true,
    });
  });

  describe("registerServiceWorker", () => {
    it("returns 'unsupported' when navigator.serviceWorker is undefined", async () => {
      // Remove serviceWorker from navigator to simulate unsupported environment
      // @ts-expect-error — intentionally removing serviceWorker
      delete navigator.serviceWorker;

      const result = await registerServiceWorker();

      expect(result.state).toBe("unsupported");
      expect(result.registration).toBeNull();
      expect(result.error).toBeNull();
    });

    it("returns 'registered' when serviceWorker.register succeeds", async () => {
      const mockRegistration = {
        scope: "/",
        installing: null,
        addEventListener: vi.fn(),
      } as unknown as ServiceWorkerRegistration;

      const mockRegister = vi.fn().mockResolvedValue(mockRegistration);

      Object.defineProperty(navigator, "serviceWorker", {
        value: { register: mockRegister },
        writable: true,
        configurable: true,
      });

      const result = await registerServiceWorker();

      expect(result.state).toBe("registered");
      expect(result.registration).toBe(mockRegistration);
      expect(result.error).toBeNull();
      expect(mockRegister).toHaveBeenCalledWith("/service-worker.js", {
        scope: "/",
      });
    });

    it("returns 'error' when serviceWorker.register fails", async () => {
      const mockError = new Error("Registration failed");
      const mockRegister = vi.fn().mockRejectedValue(mockError);

      Object.defineProperty(navigator, "serviceWorker", {
        value: { register: mockRegister },
        writable: true,
        configurable: true,
      });

      const result = await registerServiceWorker();

      expect(result.state).toBe("error");
      expect(result.registration).toBeNull();
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe("Registration failed");
    });
  });

  describe("unregisterServiceWorker", () => {
    it("returns false when navigator.serviceWorker is undefined", async () => {
      // @ts-expect-error — intentionally removing serviceWorker
      delete navigator.serviceWorker;

      const result = await unregisterServiceWorker();

      expect(result).toBe(false);
    });

    it("returns false when no service worker is registered", async () => {
      const mockGetRegistration = vi.fn().mockResolvedValue(null);

      Object.defineProperty(navigator, "serviceWorker", {
        value: { getRegistration: mockGetRegistration },
        writable: true,
        configurable: true,
      });

      const result = await unregisterServiceWorker();

      expect(result).toBe(false);
      expect(mockGetRegistration).toHaveBeenCalledWith("/");
    });

    it("returns true when service worker is unregistered", async () => {
      const mockUnregister = vi.fn().mockResolvedValue(true);
      const mockRegistration = {
        unregister: mockUnregister,
      } as unknown as ServiceWorkerRegistration;
      const mockGetRegistration = vi.fn().mockResolvedValue(mockRegistration);

      Object.defineProperty(navigator, "serviceWorker", {
        value: { getRegistration: mockGetRegistration },
        writable: true,
        configurable: true,
      });

      const result = await unregisterServiceWorker();

      expect(result).toBe(true);
      expect(mockGetRegistration).toHaveBeenCalledWith("/");
      expect(mockUnregister).toHaveBeenCalled();
    });
  });
});
