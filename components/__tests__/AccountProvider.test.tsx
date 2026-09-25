import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_account_unit_test";
  return { isLoaded: true, isSignedIn: true, userId: "alice", sessionId: "session-a", getToken: vi.fn() };
});
vi.mock("@clerk/nextjs", () => ({ ClerkProvider: ({ children }: { children: React.ReactNode }) => children, useAuth: () => auth }));
import { AccountProvider, useAccount } from "../AccountProvider";

let accountContext: ReturnType<typeof useAccount>;
function Probe() {
  accountContext = useAccount();
  return <div>{accountContext.account?.id || "no account"}{accountContext.error}</div>;
}

describe("Standard account sessions", () => {
  let container: HTMLDivElement;
  let root: Root;
  const fetcher = vi.fn();
  const render = async () => act(async () => { root.render(<AccountProvider><Probe /></AccountProvider>); });
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("fetch", fetcher);
    auth.isSignedIn = true; auth.isLoaded = true; auth.userId = "alice"; auth.sessionId = "session-a";
    auth.getToken.mockReset().mockResolvedValue("signed-session-token");
    fetcher.mockReset().mockResolvedValue(new Response(JSON.stringify({ id: "acct_alice", status: "active", wallets: [] }), { status: 200 }));
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

  it("loads account with bearer auth and no wallet or shared owner key", async () => {
    await render();
    expect(container.textContent).toBe("acct_alice");
    const [url, request] = fetcher.mock.calls[0];
    expect(url).toBe("/api/v2/account");
    expect(request.headers.get("Authorization")).toBe("Bearer signed-session-token");
    expect(request.headers.has("X-HavnAI-Studio-Key")).toBe(false);
    expect(request.credentials).toBe("omit");
  });

  it("clears the account on logout and makes no guest API requests", async () => {
    await render();
    auth.isSignedIn = false; auth.userId = ""; auth.sessionId = "";
    fetcher.mockClear();
    await render();
    expect(container.textContent).toBe("no account");
    expect(fetcher).not.toHaveBeenCalled();
    await expect(accountContext.request("/v2/account/credits")).rejects.toThrow("Sign in");
  });

  it("refreshes the signed token for privileged wallet proof requests", async () => {
    await render();
    fetcher.mockResolvedValue(new Response(JSON.stringify({ challenge_id: "proof" })));
    await accountContext.request("/v2/account/wallet-challenges", { method: "POST", body: "{}" });
    expect(auth.getToken).toHaveBeenLastCalledWith({ skipCache: true });
    fetcher.mockResolvedValue(new Response(JSON.stringify({ available_units: 0 })));
    await accountContext.request("/v2/account/credits");
    expect(auth.getToken).toHaveBeenLastCalledWith(undefined);
  });

  it("discards a previous account response after an account switch", async () => {
    let finishAlice!: (response: Response) => void;
    fetcher.mockImplementationOnce(() => new Promise<Response>(resolve => { finishAlice = resolve; }));
    await render();
    auth.userId = "bob"; auth.sessionId = "session-b";
    fetcher.mockResolvedValue(new Response(JSON.stringify({ id: "acct_bob", status: "active", wallets: [] })));
    await render();
    expect(container.textContent).toBe("acct_bob");
    await act(async () => { finishAlice(new Response(JSON.stringify({ id: "acct_alice", status: "active", wallets: [] }))); });
    expect(container.textContent).toBe("acct_bob");
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
  });

  it("does not forward tokens to arbitrary destinations or retry anonymously", async () => {
    await render();
    fetcher.mockClear();
    await expect(accountContext.request("https://other.example/v2/account")).rejects.toThrow("Invalid account API");
    expect(fetcher).not.toHaveBeenCalled();
    fetcher.mockResolvedValue(new Response(JSON.stringify({ error: { code: "invalid_account_session", message: "Sign in again." } }), { status: 401 }));
    await expect(accountContext.request("/v2/account/credits")).rejects.toThrow("Sign in again.");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
