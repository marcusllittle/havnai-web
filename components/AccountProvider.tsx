import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ClerkProvider, useAuth } from "@clerk/nextjs";

export const accountsConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export interface HavnAccount {
  id: string;
  status: "active";
  wallets: Array<{ id: string; wallet: string; namespace: string; linked_at: number }>;
  wallet_capabilities: string[];
}

interface AccountContextValue {
  configured: boolean;
  loading: boolean;
  signedIn: boolean;
  account: HavnAccount | null;
  error: string;
  refresh: () => Promise<void>;
  request: <T>(path: string, init?: RequestInit) => Promise<T>;
}

const unavailable = async (): Promise<never> => { throw new Error("Sign in is not available yet."); };
const AccountContext = createContext<AccountContextValue>({
  configured: false, loading: false, signedIn: false, account: null, error: "",
  refresh: unavailable, request: unavailable,
});

function AuthenticatedAccountProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, userId, sessionId, getToken } = useAuth();
  const [record, setRecord] = useState<{ identity: string; account: HavnAccount } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const activeIdentity = `${userId || ""}:${sessionId || ""}`;
  const account = isSignedIn && record?.identity === activeIdentity ? record.account : null;
  const identityRef = useRef(activeIdentity);
  identityRef.current = activeIdentity;
  const pending = useRef(new Set<AbortController>());

  const request = useCallback(async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    if (!isLoaded || !isSignedIn) throw new Error("Sign in to continue.");
    if (!path.startsWith("/v2/") || path.includes("..") || path.includes("\\")) throw new Error("Invalid account API path.");
    const identity = activeIdentity;
    const controller = new AbortController();
    const abort = () => controller.abort();
    init.signal?.addEventListener("abort", abort, { once: true });
    if (init.signal?.aborted) controller.abort();
    pending.current.add(controller);
    try {
      const token = await getToken();
      if (!token || identity !== identityRef.current) throw new Error("Your account session changed. Please try again.");
      const headers = new Headers(init.headers);
      headers.set("Authorization", `Bearer ${token}`);
      if (typeof init.body === "string" && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
      const response = await fetch(`/api${path}`, { ...init, headers, signal: controller.signal, credentials: "omit", cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (identity !== identityRef.current) throw new Error("Your account session changed. Please try again.");
      if (!response.ok) throw new Error(body?.error?.message || body?.message || `Request failed (${response.status}).`);
      if (body == null) throw new Error("The account service returned an invalid response.");
      return body as T;
    } finally {
      pending.current.delete(controller);
      init.signal?.removeEventListener("abort", abort);
    }
  }, [activeIdentity, getToken, isLoaded, isSignedIn]);

  const refresh = useCallback(async () => {
    setError("");
    try {
      const next = await request<HavnAccount>("/v2/account");
      setRecord({ identity: activeIdentity, account: next });
    } catch (reason) {
      if (activeIdentity === identityRef.current) setError(reason instanceof Error ? reason.message : "Could not load your account.");
      throw reason;
    }
  }, [request, activeIdentity]);

  useEffect(() => {
    pending.current.forEach(controller => controller.abort());
    setRecord(null);
    setError("");
    setLoading(Boolean(isSignedIn) || !isLoaded);
    if (!isLoaded || !isSignedIn) return;
    let current = true;
    request<HavnAccount>("/v2/account")
      .then(next => { if (current) setRecord({ identity: activeIdentity, account: next }); })
      .catch(reason => { if (current) setError(reason instanceof Error ? reason.message : "Could not load your account."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; pending.current.forEach(controller => controller.abort()); };
  }, [isLoaded, isSignedIn, activeIdentity, request]);

  const value = useMemo(() => ({ configured: true, loading, signedIn: Boolean(isSignedIn), account, error, refresh, request }),
    [loading, isSignedIn, account, error, refresh, request]);
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function AccountProvider({ children }: { children: React.ReactNode }) {
  if (!accountsConfigured) return <>{children}</>;
  return <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up" signInFallbackRedirectUrl="/account" signUpFallbackRedirectUrl="/account">
    <AuthenticatedAccountProvider>{children}</AuthenticatedAccountProvider>
  </ClerkProvider>;
}

export const useAccount = () => useContext(AccountContext);
