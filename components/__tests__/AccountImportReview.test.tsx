import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { AccountImportReview } from "../AccountImportReview";

const state = vi.hoisted(() => ({ request: vi.fn(), account: { id: "account" }, refresh: vi.fn(), connect: vi.fn(),
  recover: vi.fn(), sign: vi.fn(), submit: vi.fn(), provider: vi.fn() }));
vi.mock("../AccountProvider", () => ({ useAccount: () => state }));
vi.mock("../WalletProvider", () => ({ useWallet: () => ({ connect: state.connect, connectedWallet: null }) }));
vi.mock("../../lib/wallet", () => ({ ensureInjectedProvider: state.provider }));
vi.mock("../../lib/accountImport", () => ({ recoverImport: state.recover, signImport: state.sign, submitImport: state.submit }));
let host: HTMLDivElement, root: Root;
const review = vi.fn();
const close = vi.fn();
const inventory = { jobs: [{ id: "ready", eligible: true }, { id: "running", eligible: false, exclusion: "job_not_final" }],
  publications: [], playlists: [{ id: "playlist", title: "My tracks", eligible: true }], total: 60, playlist_total: 1, eligible_count: 59,
  credits: { available_units: 2125, scale: 1000, exclusion: null } };
const button = (text: string) => [...host.querySelectorAll<HTMLButtonElement>("button")].find(item => item.textContent === text)!;
const input = (text: string) => [...host.querySelectorAll("label")].find(item => item.textContent?.includes(text))!.querySelector("input")!;
const render = () => root.render(<AccountImportReview link={{ id: "linked", wallet: "0xwallet" }} request={review} onClose={close} />);
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.request.mockReset().mockResolvedValue(inventory); review.mockReset(); close.mockReset();
  state.refresh.mockReset().mockResolvedValue(undefined); state.connect.mockReset().mockResolvedValue("0xwallet");
  state.provider.mockReset().mockResolvedValue({ provider: {} }); state.recover.mockReset().mockResolvedValue(null);
  state.sign.mockReset().mockResolvedValue({ signature: "signed" }); state.submit.mockReset();
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
});

async function readyForImport() {
  state.request.mockImplementation(async (path: string) => path.endsWith("import-capabilities") ? { execution_enabled: true } : inventory);
  review.mockResolvedValue({ id: "snapshot", account_id: "account", jobs: [{ id: "ready" }], publications: [], playlists: [],
    credits: null, expires_at: Date.now() / 1000 + 300 });
  await act(async () => render());
  await act(async () => input("ready").click());
  await act(async () => button("Review selection").click());
  expect(state.connect).not.toHaveBeenCalled(); expect(state.sign).not.toHaveBeenCalled();
}

it("requires confirmation and reuses the signed proof after a lost response", async () => {
  await readyForImport();
  state.submit.mockRejectedValueOnce(new Error("Connection lost")).mockResolvedValue({ receipt: { id: "snapshot" } });
  await act(async () => button("Confirm import with wallet").click());
  expect(button("Review a different selection").disabled).toBe(true);
  expect(host.textContent).toContain("Connection lost");
  await act(async () => button("Retry import").click());
  expect(state.connect).toHaveBeenCalledTimes(1); expect(state.sign).toHaveBeenCalledTimes(1);
  expect(state.submit.mock.calls[0][2]).toBe(state.submit.mock.calls[1][2]);
  expect(host.textContent).toContain("Import complete"); expect(state.refresh).toHaveBeenCalledTimes(1);
});

it("recovers an existing receipt without opening the wallet", async () => {
  await readyForImport();
  state.recover.mockResolvedValue({ receipt: { id: "snapshot" } });
  await act(async () => button("Confirm import with wallet").click());
  expect(state.connect).not.toHaveBeenCalled(); expect(state.sign).not.toHaveBeenCalled(); expect(state.submit).not.toHaveBeenCalled();
  expect(host.textContent).toContain("Import complete");
});

it("aborts an in-flight signature when the account review is removed", async () => {
  await readyForImport();
  let finish!: (value: unknown) => void;
  state.sign.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  await act(async () => { button("Confirm import with wallet").click(); button("Confirm import with wallet").click(); });
  expect(state.sign).toHaveBeenCalledTimes(1);
  const signal = state.sign.mock.calls[0][0].signal;
  await act(async () => root.render(<div>Other account</div>));
  expect(signal.aborted).toBe(true);
  await act(async () => finish({ signature: "late" }));
  expect(state.submit).not.toHaveBeenCalled(); expect(host.textContent).toBe("Other account");
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

it("only reads inventory until explicit selection and review", async () => {
  await act(async () => render());
  expect(state.request).toHaveBeenCalledWith("/v2/account/wallet-links/linked/import-preview?limit=50&offset=0", expect.objectContaining({ signal: expect.any(AbortSignal) }));
  expect(review).not.toHaveBeenCalled();
  expect(button("Review selection").disabled).toBe(true);
  expect(input("running").disabled).toBe(true);
  expect(host.textContent).toContain("Still processing");
  review.mockResolvedValue({ id: "snapshot", jobs: [{ id: "ready" }], publications: [], playlists: [],
    credits: { available_units: 2125, scale: 1000 }, expires_at: Date.now() / 1000 + 300 });
  await act(async () => { input("ready").click(); input("2.125").click(); });
  await act(async () => button("Review selection").click());
  expect(JSON.parse(review.mock.calls[0][1].body)).toEqual({ job_ids: ["ready"], publication_ids: [], playlist_ids: [], workflow_ids: [], include_credits: true });
  expect(host.textContent).toContain("2.125 credits selected");
  expect(host.textContent).toContain("No content or credits have moved");
  expect(review.mock.calls.every(([path]) => path.endsWith("/import-snapshots"))).toBe(true);
});

it("keeps selections across pages and retries the same review after a lost response", async () => {
  await act(async () => render());
  await act(async () => input("My tracks").click());
  await act(async () => button("Next page").click());
  expect(state.request.mock.calls.at(-1)![0]).toContain("offset=50");
  expect(input("My tracks").checked).toBe(true);
  review.mockRejectedValue(new Error("Connection lost"));
  await act(async () => button("Review selection").click());
  const first = review.mock.calls[0][1];
  await act(async () => button("Retry same review").click());
  expect(review.mock.calls[1][1].body).toBe(first.body);
  expect(review.mock.calls[1][1].headers["Idempotency-Key"]).toBe(first.headers["Idempotency-Key"]);
  await act(async () => button("Start over").click());
  expect(input("My tracks").checked).toBe(false);
  expect(button("Review selection").disabled).toBe(true);
});

it("coalesces review clicks and aborts pending work on unmount", async () => {
  let finish!: (value: unknown) => void;
  review.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  await act(async () => render());
  await act(async () => input("ready").click());
  await act(async () => { button("Review selection").click(); button("Review selection").click(); });
  expect(review).toHaveBeenCalledTimes(1);
  const signal = review.mock.calls[0][1].signal;
  await act(async () => root.render(<div>Other account</div>));
  expect(signal.aborted).toBe(true);
  await act(async () => finish({ id: "old" }));
  expect(host.textContent).toBe("Other account");
});

it("retries failed inventory without preparing or authorizing an import", async () => {
  state.request.mockRejectedValueOnce(new Error("Offline"));
  await act(async () => render());
  expect(host.textContent).toContain("Offline");
  await act(async () => button("Retry inventory").click());
  expect(host.textContent).toContain("My tracks");
  expect(review).not.toHaveBeenCalled();
  await act(async () => button("Close review").click());
  expect(close).toHaveBeenCalledTimes(1);
});

it("reviews workflow-only selections and paginates the workflow inventory", async () => {
  state.request.mockResolvedValue({ ...inventory, jobs: [], total: 0, playlists: [], playlist_total: 0,
    workflows: [{ id: "12", title: "Portrait setup", eligible: true }], workflow_total: 60 });
  review.mockResolvedValue({ id: "snapshot", jobs: [], publications: [], playlists: [], credits: null,
    workflows: [{ id: "12", title: "Portrait setup", published: true }], expires_at: Date.now() / 1000 + 300 });
  await act(async () => render());
  expect(button("Next page").disabled).toBe(false);
  await act(async () => input("Portrait setup").click());
  await act(async () => button("Next page").click());
  expect(input("Portrait setup").checked).toBe(true);
  await act(async () => button("Review selection").click());
  expect(JSON.parse(review.mock.calls[0][1].body)).toEqual({ job_ids: [], publication_ids: [], playlist_ids: [], workflow_ids: ["12"], include_credits: false });
  expect(host.textContent).toContain("1 workflows");
  expect(host.textContent).toContain("Portrait setup — Published");
  expect(state.sign).not.toHaveBeenCalled();
});
