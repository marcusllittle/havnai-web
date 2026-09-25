// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { Wallet, toUtf8String } from "ethers";
import { signImport, submitImport, type ImportSnapshot } from "../accountImport";
import type { InjectedProvider } from "../wallet";

const signer = Wallet.createRandom();
let snapshot: ImportSnapshot, provider: InjectedProvider, rpc: ReturnType<typeof vi.fn>, request: ReturnType<typeof vi.fn>;
let events: Map<string, () => void>, controller: AbortController;
function challenge() {
  return { challenge_id: "a".repeat(64), expires_at: snapshot.expires_at, message: ["HavnAI legacy content import authorization",
    "origin: https://joinhavn.io", "account_id: alice", `wallet: ${snapshot.wallet}`, "chain_id: 11155111", "purpose: legacy_import",
    "link_id: link", `session_binding: ${snapshot.session_binding}`, `snapshot_id: ${snapshot.id}`, `snapshot_digest: ${snapshot.digest}`,
    `nonce: ${"a".repeat(64)}`, 'job_ids: ["job"]', 'publication_ids: []', 'playlist_ids: ["playlist"]',
    "credit_units: 2125", "credit_scale: 1000", `expires_at: ${snapshot.expires_at.toFixed(6)}`].join("\n") };
}
const run = () => signImport({ provider, snapshot, accountId: "alice", origin: "https://joinhavn.io", request, signal: controller.signal });
const receipt = () => ({ scale: 1000, receipt: { id: snapshot.id, account_id: "alice", digest: snapshot.digest,
  credit_units: 2125, jobs: [{ id: "job" }], publication_ids: [], playlist_ids: ["playlist"], created_at: 1 } });
const missing = () => Object.assign(new Error("Not completed"), { code: "import_receipt_not_found" });
beforeEach(() => {
  snapshot = { id: "import-one", account_id: "alice", link_id: "link", wallet: signer.address.toLowerCase(),
    session_binding: "b".repeat(64), digest: "c".repeat(64), expires_at: Date.now() / 1000 + 300,
    jobs: [{ id: "job" }], publications: [], playlists: [{ id: "playlist", title: "My playlist" }], credits: { available_units: 2125, scale: 1000 } };
  controller = new AbortController(); events = new Map();
  rpc = vi.fn(async ({ method, params }) => {
    if (method === "eth_accounts") return [snapshot.wallet];
    if (method === "eth_chainId") return "0xaa36a7";
    if (method === "personal_sign") return signer.signMessage(toUtf8String(params[0]));
    throw new Error(`Unexpected wallet request: ${method}`);
  });
  provider = { request: rpc, on: (name: string, handler: () => void) => events.set(name, handler),
    removeListener: (name: string) => events.delete(name) } as InjectedProvider;
  request = vi.fn(async () => challenge());
});

it("signs the exact reviewed proof and submits only the stored authorization", async () => {
  const proof = await run();
  expect(rpc.mock.calls.filter(([args]) => args.method === "personal_sign")).toHaveLength(1);
  expect(events.size).toBe(0);
  request.mockReset().mockRejectedValueOnce(missing()).mockResolvedValueOnce(receipt());
  await expect(submitImport(request, snapshot, proof, controller.signal)).resolves.toEqual(receipt());
  expect(JSON.parse(request.mock.calls[1][1].body)).toEqual({ challenge_id: proof.challenge_id, signature: proof.signature, chain_id: 11155111 });
});

it.each(["account_id: alice", "snapshot_digest: " + "c".repeat(64), "credit_units: 2125", 'job_ids: ["job"]', "origin: https://joinhavn.io"])("rejects altered %s before signing", async field => {
  request.mockResolvedValueOnce({ ...challenge(), message: challenge().message.replace(field, field + "-changed") });
  await expect(run()).rejects.toThrow();
  expect(rpc.mock.calls.some(([args]) => args.method === "personal_sign")).toBe(false);
});

it("rejects duplicate authorization fields", async () => {
  request.mockResolvedValueOnce({ ...challenge(), message: challenge().message + "\naccount_id: bob" });
  await expect(run()).rejects.toThrow("Ambiguous");
  expect(rpc.mock.calls.some(([args]) => args.method === "personal_sign")).toBe(false);
});

it("recovers a lost execution response without another wallet request", async () => {
  const proof = await run(); const calls = rpc.mock.calls.length;
  request.mockReset().mockRejectedValueOnce(missing()).mockRejectedValueOnce(new Error("Connection lost")).mockResolvedValueOnce(receipt());
  await expect(submitImport(request, snapshot, proof, controller.signal)).resolves.toEqual(receipt());
  expect(rpc).toHaveBeenCalledTimes(calls);
  expect(request.mock.calls.filter(([, init]) => init.method === "POST")).toHaveLength(1);
});

it("checks for an existing receipt before resubmitting and rejects mismatched receipts", async () => {
  const proof = await run();
  request.mockReset().mockResolvedValue(receipt());
  await submitImport(request, snapshot, proof, controller.signal);
  expect(request).toHaveBeenCalledTimes(1);
  request.mockReset().mockResolvedValue({ ...receipt(), receipt: { ...receipt().receipt, account_id: "bob" } });
  await expect(submitImport(request, snapshot, proof, controller.signal)).rejects.toThrow("does not match");
  expect(request).toHaveBeenCalledTimes(1);
});

it("does not accept a signature after a wallet change", async () => {
  rpc.mockImplementation(async ({ method, params }) => {
    if (method === "eth_accounts") return [snapshot.wallet];
    if (method === "eth_chainId") return "0xaa36a7";
    events.get("accountsChanged")!();
    return signer.signMessage(toUtf8String(params[0]));
  });
  await expect(run()).rejects.toThrow();
  expect(request).toHaveBeenCalledTimes(1);
  expect(events.size).toBe(0);
});

it.each(['workflow_ids: []', 'workflow_ids: ["99"]', 'workflow_ids: ["12","99"]', ""])("rejects missing or changed workflow selection: %s", async field => {
  snapshot.workflows = [{ id: "12", title: "My template", published: false }];
  request.mockResolvedValueOnce({ ...challenge(), message: challenge().message + (field ? "\n" + field : "") });
  await expect(run()).rejects.toThrow("changed your selected content");
  expect(rpc.mock.calls.some(([args]) => args.method === "personal_sign")).toBe(false);
});

it("signs selected workflows and requires the same IDs on recovery receipts", async () => {
  snapshot.workflows = [{ id: "12", title: "My template", published: true }];
  request.mockResolvedValueOnce({ ...challenge(), message: challenge().message + '\nworkflow_ids: ["12"]' });
  const proof = await run();
  request.mockReset().mockResolvedValue(receipt());
  await expect(submitImport(request, snapshot, proof, controller.signal)).rejects.toThrow("does not match");
  const completed = { ...receipt(), receipt: { ...receipt().receipt, workflow_ids: ["12"] } };
  request.mockReset().mockResolvedValue(completed);
  await expect(submitImport(request, snapshot, proof, controller.signal)).resolves.toEqual(completed);
  expect(request).toHaveBeenCalledTimes(1);
  expect(rpc.mock.calls.filter(([args]) => args.method === "personal_sign")).toHaveLength(1);
});

it("rejects unexpected workflows in an otherwise valid empty-selection proof", async () => {
  request.mockResolvedValueOnce({ ...challenge(), message: challenge().message + '\nworkflow_ids: ["12"]' });
  await expect(run()).rejects.toThrow("changed your selected content");
  expect(rpc.mock.calls.some(([args]) => args.method === "personal_sign")).toBe(false);
});

it.each(["likes", "saves"] as const)("binds selected %s to both signature and receipt", async kind => {
  const field = kind === "likes" ? "like_ids" : "save_ids";
  snapshot[kind] = [{ id: "song-one", title: "My song", already_in_account: true }];
  for (const value of ["", `${field}: []`, `${field}: ["other-song"]`]) {
    request.mockResolvedValueOnce({ ...challenge(), message: challenge().message + "\n" + value });
    await expect(run()).rejects.toThrow("changed your selected content");
  }
  expect(rpc.mock.calls.some(([args]) => args.method === "personal_sign")).toBe(false);
  request.mockResolvedValueOnce({ ...challenge(), message: challenge().message + `\n${field}: ["song-one"]` });
  const proof = await run();
  request.mockReset().mockResolvedValue(receipt());
  await expect(submitImport(request, snapshot, proof, controller.signal)).rejects.toThrow("does not match");
  const result = { ...receipt(), receipt: { ...receipt().receipt, [field]: ["song-one"] } };
  request.mockReset().mockResolvedValue(result);
  await expect(submitImport(request, snapshot, proof, controller.signal)).resolves.toEqual(result);
  expect(request).toHaveBeenCalledTimes(1);
});
