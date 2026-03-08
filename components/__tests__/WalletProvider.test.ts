import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock wallet module to test connect retry logic
// We test the core retry pattern: withTimeout + provider iteration

function makeProvider(overrides: Record<string, unknown> = {}): any {
  return {
    isMetaMask: false,
    request: vi.fn().mockResolvedValue([]),
    on: vi.fn(),
    removeListener: vi.fn(),
    ...overrides,
  };
}

// Inline withTimeout (same implementation as WalletProvider.tsx) so we can
// unit-test it without importing the React component.
class WalletError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "WalletError";
    this.code = code;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new WalletError("wallet_unknown", message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

describe("connect retry logic", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("withTimeout resolves when promise resolves before timeout", async () => {
    const result = withTimeout(Promise.resolve("ok"), 5000, "timed out");
    await expect(result).resolves.toBe("ok");
  });

  it("withTimeout rejects when promise takes too long", async () => {
    const neverResolve = new Promise(() => {}); // never settles
    const result = withTimeout(neverResolve, 1000, "timed out");

    // Advance time past the timeout
    vi.advanceTimersByTime(1001);

    await expect(result).rejects.toThrow("timed out");
  });

  it("withTimeout rejects with the promise error if it rejects before timeout", async () => {
    const failing = Promise.reject(new Error("provider broke"));
    const result = withTimeout(failing, 5000, "timed out");

    await expect(result).rejects.toThrow("provider broke");
  });

  describe("provider retry pattern", () => {
    it("succeeds with first provider", async () => {
      vi.useRealTimers(); // no fake timers needed for fast tests

      const goodProvider = makeProvider({
        isMetaMask: true,
        request: vi.fn().mockResolvedValue(["0x1234567890abcdef1234567890abcdef12345678"]),
      });

      const providers = [goodProvider];
      let connectedWith: any = null;

      for (const provider of providers) {
        try {
          const accounts = await withTimeout(
            provider.request({ method: "eth_requestAccounts" }),
            10000,
            "timeout"
          );
          connectedWith = provider;
          break;
        } catch {
          continue;
        }
      }

      expect(connectedWith).toBe(goodProvider);
      expect(goodProvider.request).toHaveBeenCalledWith({ method: "eth_requestAccounts" });
    });

    it("falls back to second provider when first rejects", async () => {
      vi.useRealTimers();

      const proxyProvider = makeProvider({
        isMetaMask: false,
        request: vi.fn().mockRejectedValue(new Error("Unexpected error")),
      });
      const mmProvider = makeProvider({
        isMetaMask: true,
        request: vi.fn().mockResolvedValue(["0x1234567890abcdef1234567890abcdef12345678"]),
      });

      const providers = [proxyProvider, mmProvider];
      let connectedWith: any = null;

      for (const provider of providers) {
        try {
          await withTimeout(
            provider.request({ method: "eth_requestAccounts" }),
            10000,
            "timeout"
          );
          connectedWith = provider;
          break;
        } catch {
          continue;
        }
      }

      expect(connectedWith).toBe(mmProvider);
      expect(proxyProvider.request).toHaveBeenCalled();
      expect(mmProvider.request).toHaveBeenCalled();
    });

    it("stops retrying on user rejection (code 4001)", async () => {
      vi.useRealTimers();

      const rejectionError = Object.assign(new Error("User rejected"), { code: 4001 });
      const provider1 = makeProvider({
        request: vi.fn().mockRejectedValue(rejectionError),
      });
      const provider2 = makeProvider({
        request: vi.fn().mockResolvedValue(["0x1234567890abcdef1234567890abcdef12345678"]),
      });

      const providers = [provider1, provider2];
      let connectedWith: any = null;
      let stoppedOnRejection = false;

      for (const provider of providers) {
        try {
          await withTimeout(
            provider.request({ method: "eth_requestAccounts" }),
            10000,
            "timeout"
          );
          connectedWith = provider;
          break;
        } catch (err: any) {
          // Simulate the real logic: stop on user rejection
          if (err.code === 4001 || /rejected/i.test(err.message)) {
            stoppedOnRejection = true;
            break;
          }
          continue;
        }
      }

      expect(connectedWith).toBeNull();
      expect(stoppedOnRejection).toBe(true);
      // Should NOT have tried provider2
      expect(provider2.request).not.toHaveBeenCalled();
    });

    it("falls back to second provider when first times out", async () => {
      const hangingProvider = makeProvider({
        request: vi.fn().mockImplementation(() => new Promise(() => {})), // never resolves
      });
      const mmProvider = makeProvider({
        isMetaMask: true,
        request: vi.fn().mockResolvedValue(["0x1234567890abcdef1234567890abcdef12345678"]),
      });

      const providers = [hangingProvider, mmProvider];
      let connectedWith: any = null;

      const tryConnect = async () => {
        for (const provider of providers) {
          try {
            await withTimeout(
              provider.request({ method: "eth_requestAccounts" }),
              100, // short timeout for test
              "timeout"
            );
            connectedWith = provider;
            break;
          } catch {
            continue;
          }
        }
      };

      const connectPromise = tryConnect();
      // Advance past the timeout for the hanging provider
      vi.advanceTimersByTime(101);
      await connectPromise;

      expect(connectedWith).toBe(mmProvider);
      expect(hangingProvider.request).toHaveBeenCalled();
      expect(mmProvider.request).toHaveBeenCalled();
    });

    it("all providers fail — reports last error", async () => {
      vi.useRealTimers();

      const provider1 = makeProvider({
        request: vi.fn().mockRejectedValue(new Error("proxy error")),
      });
      const provider2 = makeProvider({
        request: vi.fn().mockRejectedValue(new Error("also broken")),
      });

      const providers = [provider1, provider2];
      let lastError: Error | null = null;

      for (const provider of providers) {
        try {
          await withTimeout(
            provider.request({ method: "eth_requestAccounts" }),
            10000,
            "timeout"
          );
          break;
        } catch (err: any) {
          lastError = err;
          continue;
        }
      }

      expect(lastError).not.toBeNull();
      expect(lastError!.message).toBe("also broken");
    });
  });
});
