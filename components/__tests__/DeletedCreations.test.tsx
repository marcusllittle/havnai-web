import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import DeletedPage from "../../pages/account/deleted";

const state = vi.hoisted(() => ({ account: { id: "alice" } as { id: string } | null, request: vi.fn(), loading: false }));
vi.mock("../AccountProvider", () => ({ useAccount: () => state }));
vi.mock("../SiteHeader", () => ({ SiteHeader: () => null }));
vi.mock("../SeoHead", () => ({ SeoHead: () => null }));
let root: Root, host: HTMLDivElement;
const item = { job_id: "song-1", deleted_at: Date.now() / 1000, recover_until: Date.now() / 1000 + 3600, purged_at: null };
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.account = { id: "alice" }; state.request.mockReset();
  state.request.mockResolvedValue({ generations: [item] });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
it("restores privately once and clears the recovery row", async () => {
  await act(async () => root.render(<DeletedPage />));
  let finish!: () => void;
  state.request.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
  const button = host.querySelector("button")!;
  await act(async () => { button.click(); button.click(); });
  expect(button.disabled).toBe(true);
  expect(state.request.mock.calls.filter(([path]) => path.endsWith("/restore"))).toHaveLength(1);
  await act(async () => finish());
  expect(host.textContent).toContain("Restored privately");
  expect(host.textContent).not.toContain("song-1");
});
it("retains the recovery row on failure and hides it after account switching", async () => {
  await act(async () => root.render(<DeletedPage />));
  state.request.mockRejectedValueOnce(new Error("Offline"));
  await act(async () => host.querySelector("button")!.click());
  expect(host.textContent).toContain("Could not restore");
  expect(host.textContent).toContain("song-1");
  state.account = { id: "bob" }; state.request.mockResolvedValue({ generations: [] });
  await act(async () => root.render(<DeletedPage />));
  expect(host.textContent).not.toContain("song-1");
});
it("does not offer restore after the recovery deadline", async () => {
  state.request.mockResolvedValue({ generations: [{ ...item, recover_until: 1 }] });
  await act(async () => root.render(<DeletedPage />));
  expect(host.textContent).toContain("Recovery window ended");
  expect(host.querySelector("button")).toBeNull();
});

const buttonNamed = (text: string) => [...host.querySelectorAll("button")].find(button => button.textContent === text)!;

it("loads older pages once, restores their creations and returns to the latest page", async () => {
  state.request.mockResolvedValueOnce({ generations: [item], next_cursor: "position+/=" });
  await act(async () => root.render(<DeletedPage />));
  let finish!: (value: unknown) => void;
  state.request.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const older = buttonNamed("Older deletions");
  await act(async () => { older.click(); older.click(); });
  expect(state.request).toHaveBeenCalledTimes(2);
  expect(state.request.mock.calls[1][0]).toBe("/v2/account/deleted-generations?before=position%2B%2F%3D");
  expect(host.textContent).not.toContain("song-1");
  await act(async () => finish({ generations: [{ ...item, job_id: "older-song" }], next_cursor: null }));
  expect(host.textContent).toContain("older-song");
  state.request.mockResolvedValueOnce({});
  await act(async () => buttonNamed("Restore privately").click());
  expect(host.textContent).not.toContain("older-song");
  expect(host.textContent).toContain("Nothing left on this page");
  await act(async () => buttonNamed("Latest deletions").click());
  expect(state.request.mock.calls.at(-1)?.[0]).toBe("/v2/account/deleted-generations");
  expect(host.textContent).toContain("song-1");
});

it("retains navigation to older creations after restoring the last visible row", async () => {
  state.request.mockResolvedValueOnce({ generations: [item], next_cursor: "older" });
  await act(async () => root.render(<DeletedPage />));
  let finish!: () => void;
  state.request.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
  await act(async () => buttonNamed("Restore privately").click());
  expect(buttonNamed("Older deletions").disabled).toBe(true);
  await act(async () => finish());
  expect(host.textContent).toContain("Nothing left on this page");
  expect(host.textContent).not.toContain("No deleted creations");
  expect(buttonNamed("Older deletions").disabled).toBe(false);
});

it("retries a failed page at the same cursor without showing the previous page", async () => {
  state.request.mockResolvedValueOnce({ generations: [item], next_cursor: "older" });
  await act(async () => root.render(<DeletedPage />));
  state.request.mockRejectedValueOnce(new Error("Offline"));
  await act(async () => buttonNamed("Older deletions").click());
  expect(host.textContent).toContain("Could not load deleted creations");
  expect(host.textContent).not.toContain("song-1");
  state.request.mockResolvedValueOnce({ generations: [{ ...item, job_id: "older-song" }], next_cursor: null });
  await act(async () => buttonNamed("Try again").click());
  expect(state.request.mock.calls.at(-1)?.[0]).toBe("/v2/account/deleted-generations?before=older");
  expect(host.textContent).toContain("older-song");
});

it("aborts an older-page response on account switch and resets the cursor", async () => {
  state.request.mockResolvedValueOnce({ generations: [item], next_cursor: "older" });
  await act(async () => root.render(<DeletedPage />));
  let finish!: (value: unknown) => void;
  state.request.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await act(async () => buttonNamed("Older deletions").click());
  const signal = state.request.mock.calls[1][1].signal;
  state.account = { id: "bob" }; state.request.mockResolvedValueOnce({ generations: [], next_cursor: null });
  await act(async () => root.render(<DeletedPage />));
  expect(signal.aborted).toBe(true);
  expect(state.request.mock.calls.at(-1)?.[0]).toBe("/v2/account/deleted-generations");
  await act(async () => finish({ generations: [{ ...item, job_id: "alice-late-result" }], next_cursor: "alice-next" }));
  expect(host.textContent).not.toContain("alice-late-result");
  expect(buttonNamed("Older deletions")).toBeUndefined();
  expect(buttonNamed("Latest deletions")).toBeUndefined();
});
