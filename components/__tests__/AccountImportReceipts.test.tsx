import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { AccountImportReceipts } from "../AccountImportReceipts";

const state = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("../AccountProvider", () => ({ useAccount: () => state }));
let host: HTMLDivElement, root: Root;
const button = (text: string) => [...host.querySelectorAll<HTMLButtonElement>("button")].find(node => node.textContent === text)!;
const page = { total: 11, scale: 1000, receipts: [{ id: "import-one", created_at: 1000, job_count: 1, publication_count: 1, playlist_count: 1, credit_units: 2125 }] };
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.request.mockReset().mockResolvedValue(page);
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

it("loads account-owned history only on demand and never sends a mutation", async () => {
  await act(async () => root.render(<AccountImportReceipts />));
  expect(state.request).not.toHaveBeenCalled();
  await act(async () => button("View import history").click());
  expect(state.request.mock.calls[0][0]).toBe("/v2/account/import-receipts?limit=10&offset=0");
  expect(host.textContent).toContain("2.125 credits");
  state.request.mockResolvedValueOnce({ scale: 1000, receipt: { id: "import-one", wallet: "0xoriginal-wallet", credit_units: 2125,
    jobs: [{ id: "job-one" }], publication_ids: ["song-one"], playlist_ids: ["playlist-one"] } });
  await act(async () => button("View receipt").click());
  expect(host.textContent).toContain("Creation: job-one");
  expect(host.textContent).toContain("Publication: song-one");
  expect(host.textContent).toContain("Playlist: playlist-one");
  expect(state.request.mock.calls.every(([, init]) => !init.method)).toBe(true);
});

it("paginates receipts and distinguishes load failure from empty history", async () => {
  state.request.mockRejectedValueOnce(new Error("Offline"));
  await act(async () => root.render(<AccountImportReceipts />));
  await act(async () => button("View import history").click());
  expect(host.textContent).toContain("Offline");
  expect(host.textContent).not.toContain("No completed imports");
  await act(async () => button("Refresh import receipts").click());
  await act(async () => button("Older imports").click());
  expect(state.request.mock.calls.at(-1)![0]).toContain("offset=10");
  state.request.mockResolvedValue({ total: 0, receipts: [], scale: 1000 });
  await act(async () => button("Refresh import receipts").click());
  expect(host.textContent).toContain("No completed imports yet");
});

it("aborts private receipt reads when the account changes", async () => {
  await act(async () => root.render(<AccountImportReceipts key="alice" />));
  await act(async () => button("View import history").click());
  let finish!: (value: unknown) => void;
  state.request.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await act(async () => button("View receipt").click());
  const signal = state.request.mock.calls.at(-1)![1].signal;
  await act(async () => root.render(<AccountImportReceipts key="bob" />));
  expect(signal.aborted).toBe(true);
  await act(async () => finish({ scale: 1000, receipt: { id: "import-one", wallet: "private-old-wallet", jobs: [], credit_units: 2125 } }));
  expect(host.textContent).not.toContain("private-old-wallet");
  expect(button("View import history")).toBeDefined();
});
