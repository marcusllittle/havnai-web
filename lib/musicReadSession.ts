export interface MusicReadSession { wallet: string; token: string; expires_at: number }
const STORAGE_KEY = "havnai.music.read-session.v1";
const pending = new Map<string, Promise<MusicReadSession>>();
let session: MusicReadSession | null = null;
let generation = 0;

function storage(): Storage | undefined {
  try { return typeof window === "undefined" ? undefined : window.sessionStorage; } catch { return undefined; }
}

export function clearMusicReadSession(): void {
  generation += 1;
  session = null;
  pending.clear();
  try { storage()?.removeItem(STORAGE_KEY); } catch { /* Storage may be disabled. */ }
}

export async function getMusicReadSession(wallet: string, create: () => Promise<MusicReadSession>): Promise<MusicReadSession> {
  const key = wallet.toLowerCase();
  if (!session) {
    try { session = JSON.parse(storage()?.getItem(STORAGE_KEY) || "null"); } catch { session = null; }
  }
  if (session?.wallet?.toLowerCase() === key && session.token && session.expires_at * 1000 > Date.now() + 30_000) return session;
  const existing = pending.get(key);
  if (existing) return existing;
  const version = generation;
  const request = Promise.resolve().then(create).then(result => {
    if (version !== generation) throw new Error("Wallet changed while music access was being authorized. Try again with your current wallet.");
    if (result.wallet?.toLowerCase() !== key || !result.token || !Number.isFinite(result.expires_at) || result.expires_at * 1000 <= Date.now()) {
      throw new Error("The coordinator returned an invalid music session.");
    }
    session = result;
    try { storage()?.setItem(STORAGE_KEY, JSON.stringify(result)); } catch { /* Memory still works. */ }
    return result;
  }).finally(() => { if (pending.get(key) === request) pending.delete(key); });
  pending.set(key, request);
  return request;
}
