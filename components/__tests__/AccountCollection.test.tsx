import React, { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Collection from "../../pages/library";
import { fetchJob, fetchMyJobs, fetchResult } from "../../lib/havnai";

const state = vi.hoisted(() => ({ configured: true, signedIn: true, loading: false,
  account: { id: "alice" } as { id: string } | null, request: vi.fn(), connect: vi.fn() }));
vi.mock("../AccountProvider", () => ({ useAccount: () => state }));
vi.mock("../SiteHeader", () => ({ SiteHeader: () => null }));
vi.mock("../SeoHead", () => ({ SeoHead: () => null }));
vi.mock("../JobDetailsDrawer", () => ({ JobDetailsDrawer: () => null }));
vi.mock("../WalletProvider", () => ({ useWallet: () => ({ activeWallet: "0xlegacy", source: "connected", connect: state.connect }) }));
vi.mock("../../lib/havnai", async original => ({ ...await original<typeof import("../../lib/havnai")>(),
  fetchJob: vi.fn(), fetchMyJobs: vi.fn(), fetchResult: vi.fn() }));
const job = (id: number, owner = "alice") => ({ id: `job-${id}`, owner_account_id: owner, type: "image", status: "succeeded",
  progress: 100, created_at: 1000 - id, model: "SDXL", collection_hidden: false,
  resolved_spec: { parameters: { prompt: `Coast ${id}` } },
  artifacts: [{ id: `art-${id}`, kind: "image", url: `/v2/artifacts/art-${id}/content` }] });
let host: HTMLDivElement, root: Root;
let hidden: Set<string>;
const button = (label: string) => [...host.querySelectorAll("button")].find(el => el.textContent?.trim() === label)!;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); localStorage.clear(); vi.clearAllMocks();
  state.account = { id: "alice" }; state.signedIn = true; hidden = new Set();
  state.request.mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === "/v2/account/collection") {
      const body = JSON.parse(String(init?.body));
      for (const id of body.job_ids) body.hidden ? hidden.add(id) : hidden.delete(id);
      return body;
    }
    const params = new URL(path, "http://local").searchParams;
    const jobs = Array.from({ length: 51 }, (_, id) => job(id)).filter(item => !hidden.has(item.id) &&
      (!params.get("search") || item.resolved_spec.parameters.prompt.toLowerCase().includes(params.get("search")!.toLowerCase())));
    const offset = Number(params.get("offset"));
    return { jobs: jobs.slice(offset, offset + 50), total: jobs.length };
  });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); localStorage.clear(); vi.unstubAllGlobals(); });

it("loads beyond the first page using private account media without legacy or wallet calls", async () => {
  await act(async () => root.render(<StrictMode><Collection /></StrictMode>));
  expect(host.querySelectorAll(".library-card")).toHaveLength(50);
  expect(host.querySelector('img[src="/api/account-media/art-0"]')).not.toBeNull();
  await act(async () => button("Load more creations").click());
  expect(host.querySelectorAll(".library-card")).toHaveLength(51);
  expect(button("Load more creations")).toBeUndefined();
  expect(fetchJob).not.toHaveBeenCalled(); expect(fetchResult).not.toHaveBeenCalled(); expect(fetchMyJobs).not.toHaveBeenCalled();
  expect(state.connect).not.toHaveBeenCalled();
});

it("keeps search controls and clear filters available after an empty server result", async () => {
  await act(async () => root.render(<Collection />));
  const input = host.querySelector<HTMLInputElement>('[aria-label="Search collection"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "missing");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(host.textContent).toContain("No matches this time.");
  expect(host.querySelector('[aria-label="Search collection"]')).not.toBeNull();
  expect(host.querySelector(".collection-empty")).toBeNull();
  await act(async () => button("Clear filters").click());
  expect(host.querySelectorAll(".library-card")).toHaveLength(50);
});

it("aborts a previous account request and ignores its late private results", async () => {
  let finish!: (value: unknown) => void;
  state.request.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await act(async () => root.render(<Collection />));
  const signal = state.request.mock.calls[0][1].signal;
  state.account = { id: "bob" };
  state.request.mockResolvedValue({ jobs: [], total: 0 });
  await act(async () => root.render(<Collection />));
  expect(signal.aborted).toBe(true);
  await act(async () => finish({ jobs: [job(0)], total: 1 }));
  expect(host.querySelectorAll(".library-card")).toHaveLength(0);
  state.signedIn = false; state.account = null;
  await act(async () => root.render(<Collection />));
  expect(host.querySelector('a[href="/sign-in"]')).not.toBeNull();
});

it("does not report an empty collection when the account service fails", async () => {
  state.request.mockRejectedValue(new Error("Offline"));
  await act(async () => root.render(<Collection />));
  expect(host.textContent).toContain("refresh your history");
  expect(host.querySelector(".collection-empty")).toBeNull();
  expect(host.querySelector('[aria-label="Refresh collection"]')).not.toBeNull();
});

it("retains work after rejected removal and persists successful removal across remounts", async () => {
  await act(async () => root.render(<Collection />));
  state.request.mockRejectedValueOnce(new Error("Could not save changes"));
  await act(async () => button("Remove from collection").click());
  expect(host.textContent).toContain("Could not save changes");
  expect(host.querySelector('img[src="/api/account-media/art-0"]')).not.toBeNull();
  await act(async () => button("Remove from collection").click());
  expect(hidden.has("job-0")).toBe(true);
  expect(host.querySelector('img[src="/api/account-media/art-0"]')).toBeNull();
  await act(async () => root.render(<Collection key="reload" />));
  expect(host.querySelector('img[src="/api/account-media/art-0"]')).toBeNull();
  expect(host.querySelectorAll(".library-card")).toHaveLength(50);
});
