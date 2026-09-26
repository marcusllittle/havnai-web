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
