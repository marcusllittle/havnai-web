// Shared API base URL helper — extracted so SSE and other modules can use it
// without importing the full havnai.ts (which pulls in types that may not be needed).

export function getApiBase(): string {
  const envBase =
    process.env.NEXT_PUBLIC_HAVNAI_API_BASE && process.env.NEXT_PUBLIC_HAVNAI_API_BASE.length > 0
      ? process.env.NEXT_PUBLIC_HAVNAI_API_BASE
      : undefined;

  if (typeof window !== "undefined") {
    const origin = window.location.origin || "";
    const isLocalhost =
      origin.startsWith("http://localhost") || origin.startsWith("http://127.0.0.1");

    if (isLocalhost && envBase) {
      return envBase;
    }

    return "/api";
  }

  return envBase || "/api";
}
