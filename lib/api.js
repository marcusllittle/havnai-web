// Resolve API base — in the browser, always use the /api proxy to avoid mixed-content
// (HTTPS page calling HTTP backend directly). Only use the raw env URL for localhost dev.
function resolveBase() {
  const envBase =
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_BASE_URL) ||
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_HAVNAI_API_BASE) ||
    (typeof window !== "undefined" && window.NEXT_PUBLIC_API_BASE_URL) ||
    (typeof window !== "undefined" && window.NEXT_PUBLIC_HAVNAI_API_BASE) ||
    (typeof globalThis !== "undefined" && globalThis.NEXT_PUBLIC_API_BASE_URL) ||
    (typeof globalThis !== "undefined" && globalThis.NEXT_PUBLIC_HAVNAI_API_BASE) ||
    "";

  if (typeof window !== "undefined") {
    const origin = window.location.origin || "";
    const isLocalhost =
      origin.startsWith("http://localhost") || origin.startsWith("http://127.0.0.1");
    if (isLocalhost && envBase) return envBase;
    return "/api";
  }

  return envBase || "/api";
}

const BASE = resolveBase();

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
