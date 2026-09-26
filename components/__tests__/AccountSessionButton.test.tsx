import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AccountSessionButton } from "../AccountSessionButton";

const state = vi.hoisted(() => ({ signedIn: false, loading: false, signOut: vi.fn() }));
vi.mock("../AccountProvider", () => ({ useAccount: () => state }));
vi.mock("@clerk/nextjs", () => ({ useClerk: () => ({ signOut: state.signOut }) }));
let root: Root, host: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.signedIn = false; state.loading = false; state.signOut.mockReset();
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

it("changes the same header control from sign-in to sign-out and back", async () => {
  await act(async () => root.render(<AccountSessionButton />));
  const link = host.querySelector("a")!;
  expect(link.getAttribute("href")).toBe("/sign-in");
  expect(link.textContent).toBe("Sign in");
  state.signedIn = true;
  await act(async () => root.render(<AccountSessionButton />));
  expect(host.querySelector("a")).toBeNull();
  expect(host.querySelector("button")!.textContent).toBe("Sign out");
  expect(host.querySelector("button")!.className).toBe(link.className);
  state.signedIn = false;
  await act(async () => root.render(<AccountSessionButton />));
  expect(host.querySelector("a")!.textContent).toBe("Sign in");
});

it("waits for session loading but allows sign-out when the backend account is loading", async () => {
  state.loading = true;
  await act(async () => root.render(<AccountSessionButton />));
  expect(host.querySelector("button")!.disabled).toBe(true);
  expect(host.querySelector("a")).toBeNull();
  state.signedIn = true;
  await act(async () => root.render(<AccountSessionButton />));
  expect(host.querySelector("button")!.disabled).toBe(false);
  expect(host.querySelector("button")!.textContent).toBe("Sign out");
});

it("signs out through Clerk once per click sequence and lets a failed request retry", async () => {
  state.signedIn = true;
  let reject!: (error: Error) => void;
  state.signOut.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
  await act(async () => root.render(<AccountSessionButton />));
  const button = host.querySelector("button")!;
  await act(async () => { button.click(); button.click(); });
  expect(state.signOut).toHaveBeenCalledExactlyOnceWith({ redirectUrl: "/" });
  expect(button.disabled).toBe(true);
  expect(button.textContent).toBe("Signing out…");
  await act(async () => reject(new Error("Network unavailable")));
  expect(host.querySelector('[role="alert"]')!.textContent).toContain("Couldn't sign out");
  expect(button.disabled).toBe(false);
  state.signOut.mockResolvedValueOnce(undefined);
  await act(async () => button.click());
  expect(state.signOut).toHaveBeenCalledTimes(2);
  expect(host.querySelector('[role="alert"]')).toBeNull();
});
