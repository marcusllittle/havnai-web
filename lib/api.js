// Prefer env when available (Next.js / Vercel), otherwise accept a global injected value.
const BASE =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_BASE_URL) ||
  (typeof window !== "undefined" && window.NEXT_PUBLIC_API_BASE_URL) ||
  (typeof globalThis !== "undefined" && globalThis.NEXT_PUBLIC_API_BASE_URL) ||
  "/api";

// Wrapper for GET
export async function apiGet(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed with status ${res.status}`);
  return res.json();
}

// Wrapper for POST
export async function apiPost(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} failed with status ${res.status}`);
  return res.json();
}
