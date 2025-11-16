// Use env when available (e.g., Next.js), otherwise fall back to empty string for relative paths.
const BASE = (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_BASE_URL) || "";

// Wrapper for GET
export async function apiGet(path) {
  const res = await fetch(`${BASE}${path}`);
  return res.json();
}

// Wrapper for POST
export async function apiPost(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}
