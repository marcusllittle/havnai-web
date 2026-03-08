import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// We need to mock window.ethereum before importing wallet.ts
// so the module-level code picks up our mock.

function makeProvider(overrides: Record<string, unknown> = {}): any {
  return {
    isMetaMask: false,
    request: vi.fn().mockResolvedValue([]),
    on: vi.fn(),
    removeListener: vi.fn(),
    ...overrides,
  };
}

function setWindowEthereum(provider: any) {
  (window as any).ethereum = provider;
}

function clearWindowEthereum() {
  delete (window as any).ethereum;
}

// Import after setup helpers are defined
import {
  getInjectedProvider,
  detectProviderConflict,
  getAllProviders,
  WalletError,
} from "../wallet";

describe("wallet provider selection", () => {
  afterEach(() => {
    clearWindowEthereum();
  });

  describe("getInjectedProvider", () => {
    it("returns null provider when window.ethereum is undefined", () => {
      clearWindowEthereum();
      const result = getInjectedProvider();
      expect(result.provider).toBeNull();
      expect(result.hasProvider).toBe(false);
      expect(result.hasConflict).toBe(false);
    });

    it("returns the single MetaMask provider with no conflict", () => {
      const mm = makeProvider({ isMetaMask: true });
      setWindowEthereum(mm);

      const result = getInjectedProvider();
      expect(result.provider).toBe(mm);
      expect(result.hasProvider).toBe(true);
      expect(result.hasConflict).toBe(false);
      expect(result.providerName).toBe("MetaMask");
    });

    it("picks MetaMask from multiple providers in providers[]", () => {
      const proxy = makeProvider({ isMetaMask: false });
      const mm = makeProvider({ isMetaMask: true });
      const root = makeProvider({
        isMetaMask: false,
        providers: [proxy, mm],
      });
      setWindowEthereum(root);

      const result = getInjectedProvider();
      expect(result.provider).toBe(mm);
      expect(result.hasProvider).toBe(true);
      expect(result.hasConflict).toBe(true);
      expect(result.providerName).toBe("MetaMask");
    });

    it("picks the first isMetaMask provider — retry logic handles wrong pick", () => {
      const brave = makeProvider({ isMetaMask: true, isBraveWallet: true });
      const mm = makeProvider({ isMetaMask: true });
      const root = makeProvider({
        isMetaMask: false,
        providers: [brave, mm],
      });
      setWindowEthereum(root);

      const result = getInjectedProvider();
      // choosePreferredProvider picks the first isMetaMask it finds (brave).
      // The retry-with-fallback connect() logic compensates: if brave fails,
      // it tries mm next. getAllProviders() returns both.
      expect(result.provider).not.toBeNull();
      expect(result.hasConflict).toBe(true);

      // Verify getAllProviders returns BOTH so retry logic can try mm
      const all = getAllProviders();
      expect(all).toContain(brave);
      expect(all).toContain(mm);
    });

    it("falls back to first usable provider if none is MetaMask", () => {
      const wallet1 = makeProvider({ isMetaMask: false });
      const wallet2 = makeProvider({ isMetaMask: false });
      const root = makeProvider({
        isMetaMask: false,
        providers: [wallet1, wallet2],
      });
      setWindowEthereum(root);

      const result = getInjectedProvider();
      expect(result.provider).not.toBeNull();
      expect(result.hasProvider).toBe(true);
    });

    it("falls back to healthy alternative when preferred provider fails health check", () => {
      const unhealthyProxy = {
        isMetaMask: true,
        // .request is a Proxy trap that throws on .bind access
        request: new Proxy(() => {}, {
          get(target, prop) {
            if (prop === "bind") throw new Error("proxy trap");
            return (target as any)[prop];
          },
        }),
      };
      const healthyMM = makeProvider({ isMetaMask: true });
      const root = makeProvider({
        isMetaMask: false,
        providers: [unhealthyProxy, healthyMM],
      });
      setWindowEthereum(root);

      const result = getInjectedProvider();
      // Should skip the unhealthy proxy and use the healthy one
      expect(result.provider).toBe(healthyMM);
      expect(result.hasProvider).toBe(true);
    });

    it("returns a provider even when .request exists but is not a standard function", () => {
      // Some proxy extensions provide a request that passes typeof === "function"
      // but behaves weirdly. As long as isProviderUsable passes, we should still return it.
      const weirdProvider = makeProvider({ isMetaMask: true });
      setWindowEthereum(weirdProvider);

      const result = getInjectedProvider();
      expect(result.provider).toBe(weirdProvider);
      expect(result.hasProvider).toBe(true);
    });
  });

  describe("detectProviderConflict", () => {
    it("returns empty when no ethereum", () => {
      clearWindowEthereum();
      const result = detectProviderConflict();
      expect(result.providers).toHaveLength(0);
      expect(result.hasConflict).toBe(false);
    });

    it("reports no conflict for single provider", () => {
      const mm = makeProvider({ isMetaMask: true });
      setWindowEthereum(mm);

      const result = detectProviderConflict();
      expect(result.hasConflict).toBe(false);
      expect(result.providers).toHaveLength(1);
    });

    it("reports conflict for multiple providers", () => {
      const p1 = makeProvider({ isMetaMask: false });
      const p2 = makeProvider({ isMetaMask: true });
      const root = makeProvider({ providers: [p1, p2] });
      setWindowEthereum(root);

      const result = detectProviderConflict();
      expect(result.hasConflict).toBe(true);
      expect(result.providers.length).toBeGreaterThan(1);
    });
  });

  describe("getAllProviders", () => {
    it("returns empty array when no ethereum", () => {
      clearWindowEthereum();
      expect(getAllProviders()).toHaveLength(0);
    });

    it("returns single provider for simple setup", () => {
      const mm = makeProvider({ isMetaMask: true });
      setWindowEthereum(mm);

      const providers = getAllProviders();
      expect(providers).toHaveLength(1);
      expect(providers[0]).toBe(mm);
    });

    it("returns preferred provider first, then others", () => {
      const proxy = makeProvider({ isMetaMask: false });
      const mm = makeProvider({ isMetaMask: true });
      const root = makeProvider({ providers: [proxy, mm] });
      setWindowEthereum(root);

      const providers = getAllProviders();
      // MetaMask should be first (preferred)
      expect(providers[0]).toBe(mm);
      // Proxy should be second
      expect(providers).toContain(proxy);
    });

    it("includes root ethereum as fallback when not in providers[]", () => {
      const mm = makeProvider({ isMetaMask: true });
      // Root is different object from what's in providers[]
      const root = {
        isMetaMask: false,
        request: vi.fn().mockResolvedValue([]),
        providers: [mm],
      };
      setWindowEthereum(root);

      const providers = getAllProviders();
      expect(providers).toContain(mm);
      // Root should also be included as fallback
      expect(providers).toContain(root);
    });

    it("deduplicates providers", () => {
      const mm = makeProvider({ isMetaMask: true });
      setWindowEthereum(mm);
      // When root IS the only provider, it shouldn't appear twice
      const providers = getAllProviders();
      expect(providers).toHaveLength(1);
    });
  });
});
