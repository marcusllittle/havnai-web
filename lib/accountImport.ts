import { verifyMessage } from "ethers";
import type { InjectedProvider } from "./wallet";
import type { MusicAccountRequest } from "./accountMusicClient";
import { abortable, signAccountProof } from "./accountWalletProof";

export interface ImportSnapshot {
  id: string; account_id: string; wallet: string; link_id: string; session_binding: string; digest: string; expires_at: number;
  jobs: Array<{ id: string }>; publications?: Array<{ id: string; title: string }>;
  playlists?: Array<{ id: string; title: string }>;
  workflows?: Array<{ id: string; title: string; published: boolean }>;
  credits: { available_units: number; scale: number } | null;
}
export interface ImportProof { challenge_id: string; signature: string; chain_id: number; snapshot_id: string; digest: string }
export interface ImportReceipt { scale: number; receipt: { id: string; account_id: string; digest: string; credit_units: number;
  jobs: Array<{ id: string }>; publication_ids?: string[]; playlist_ids?: string[]; workflow_ids?: string[]; created_at: number } }
const ids = (items?: Array<{ id: string }>) => (items || []).map(item => item.id);
const same = (left: string[], right: string[]) => JSON.stringify(left) === JSON.stringify(right);

/** Called only after explicit review confirmation. Retain its result in memory for retries. */
export async function signImport({ provider, snapshot, accountId, origin, request, signal }: {
  provider: InjectedProvider; snapshot: ImportSnapshot; accountId: string; origin: string;
  request: MusicAccountRequest; signal: AbortSignal;
}): Promise<ImportProof> {
  if (snapshot.account_id !== accountId || !Number.isFinite(snapshot.expires_at) || snapshot.expires_at * 1000 <= Date.now()) throw new Error("This review expired or belongs to another account. Prepare a new review.");
  if (snapshot.credits && (snapshot.credits.scale !== 1000 || !Number.isSafeInteger(snapshot.credits.available_units)
      || snapshot.credits.available_units < 0 || snapshot.credits.available_units > 1e15)) throw new Error("The reviewed credit amount is invalid.");
  const operation = new AbortController(); const cancel = () => operation.abort();
  signal.addEventListener("abort", cancel, { once: true }); if (signal.aborted) cancel();
  for (const event of ["accountsChanged", "chainChanged", "disconnect"]) provider.on?.(event, cancel);
  const rpc = <T,>(method: string) => abortable(provider.request({ method }) as Promise<T>, operation.signal, 15_000);
  try {
    const accounts = await rpc<string[]>("eth_accounts");
    if (accounts[0]?.toLowerCase() !== snapshot.wallet.toLowerCase()) throw new Error("Select the linked wallet address before confirming this import.");
    const chain = Number(await rpc<string>("eth_chainId"));
    if (![1, 11155111].includes(chain)) throw new Error("Select Ethereum or Sepolia before confirming.");
    const challenge = await request<{ challenge_id: string; message: string; expires_at: number }>(
      `/v2/account/import-snapshots/${encodeURIComponent(snapshot.id)}/challenge`, {
        method: "POST", signal: operation.signal, body: JSON.stringify({ chain_id: chain }),
      });
    operation.signal.throwIfAborted();
    const fields = new Map<string, string>();
    if (typeof challenge.message !== "string") throw new Error("Invalid import confirmation.");
    for (const line of challenge.message.split("\n")) {
      const colon = line.indexOf(": "); if (colon < 0) continue;
      const key = line.slice(0, colon); if (fields.has(key)) throw new Error("Ambiguous import confirmation.");
      fields.set(key, line.slice(colon + 2));
    }
    const expected = { account_id: accountId, wallet: snapshot.wallet.toLowerCase(), origin, chain_id: String(chain),
      purpose: "legacy_import", link_id: snapshot.link_id, session_binding: snapshot.session_binding,
      snapshot_id: snapshot.id, snapshot_digest: snapshot.digest, nonce: challenge.challenge_id,
      credit_units: String(snapshot.credits?.available_units || 0), credit_scale: "1000" };
    if (!/^[a-f0-9]{64}$/.test(challenge.challenge_id) || !Number.isFinite(challenge.expires_at)
        || challenge.expires_at !== snapshot.expires_at || challenge.expires_at * 1000 <= Date.now()
        || Object.entries(expected).some(([key, value]) => fields.get(key) !== value)
        || Math.abs(Number(fields.get("expires_at")) - snapshot.expires_at) > 0.000001
        || !Number.isFinite(Number(fields.get("expires_at")))) throw new Error("The wallet confirmation does not match your reviewed import.");
    try {
      if (!same(JSON.parse(fields.get("job_ids") || "null"), ids(snapshot.jobs))
          || !same(JSON.parse(fields.get("publication_ids") || "null"), ids(snapshot.publications))
          || !same(JSON.parse(fields.get("playlist_ids") || "null"), ids(snapshot.playlists))
          || !same(JSON.parse(fields.get("workflow_ids") || "[]"), ids(snapshot.workflows))) throw new Error();
    } catch { throw new Error("The wallet confirmation changed your selected content."); }
    const signature = await signAccountProof(provider, challenge.message, snapshot.wallet.toLowerCase(), operation.signal);
    operation.signal.throwIfAborted();
    if (typeof signature !== "string" || verifyMessage(challenge.message, signature).toLowerCase() !== snapshot.wallet.toLowerCase()) throw new Error("The signature came from a different wallet.");
    if ((await rpc<string[]>("eth_accounts"))[0]?.toLowerCase() !== snapshot.wallet.toLowerCase()
        || Number(await rpc<string>("eth_chainId")) !== chain) throw new Error("Your wallet or network changed. Review again before importing.");
    return { challenge_id: challenge.challenge_id, signature, chain_id: chain, snapshot_id: snapshot.id, digest: snapshot.digest };
  } finally {
    signal.removeEventListener("abort", cancel);
    for (const event of ["accountsChanged", "chainChanged", "disconnect"]) provider.removeListener?.(event, cancel);
  }
}

function verifiedReceipt(result: ImportReceipt, snapshot: ImportSnapshot): ImportReceipt {
  const row = result?.receipt;
  if (!row || result.scale !== 1000 || row.id !== snapshot.id || row.account_id !== snapshot.account_id || row.digest !== snapshot.digest
      || row.credit_units !== (snapshot.credits?.available_units || 0) || !same(ids(row.jobs), ids(snapshot.jobs))
      || !same(row.publication_ids || [], ids(snapshot.publications)) || !same(row.playlist_ids || [], ids(snapshot.playlists))
      || !same(row.workflow_ids || [], ids(snapshot.workflows))) {
    throw new Error("The receipt does not match this import. Check your account's import history before trying again.");
  }
  return result;
}

export async function recoverImport(request: MusicAccountRequest, snapshot: ImportSnapshot, signal: AbortSignal): Promise<ImportReceipt | null> {
  try {
    const result = await request<ImportReceipt>(`/v2/account/import-receipts/${encodeURIComponent(snapshot.id)}`, { signal });
    signal.throwIfAborted(); return verifiedReceipt(result, snapshot);
  } catch (reason) {
    signal.throwIfAborted();
    if (reason && typeof reason === "object" && "code" in reason && reason.code === "import_receipt_not_found") return null;
    throw reason;
  }
}

/** Retries reuse the same signed proof. This function never contacts a wallet. */
export async function submitImport(request: MusicAccountRequest, snapshot: ImportSnapshot, proof: ImportProof, signal: AbortSignal) {
  if (proof.snapshot_id !== snapshot.id || proof.digest !== snapshot.digest) throw new Error("Import proof belongs to a different review.");
  const recovered = await recoverImport(request, snapshot, signal);
  if (recovered) return recovered;
  try {
    const result = await request<ImportReceipt>(`/v2/account/import-snapshots/${encodeURIComponent(snapshot.id)}/execute`, {
      method: "POST", signal, body: JSON.stringify({ challenge_id: proof.challenge_id, signature: proof.signature, chain_id: proof.chain_id }),
    });
    signal.throwIfAborted(); return verifiedReceipt(result, snapshot);
  } catch (reason) {
    signal.throwIfAborted();
    const receipt = await recoverImport(request, snapshot, signal);
    if (receipt) return receipt;
    throw reason;
  }
}
