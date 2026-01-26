const STORAGE_KEY = "havnai.invite_code.v1";

export function getInviteCode(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const value = window.localStorage.getItem(STORAGE_KEY);
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

export function setInviteCode(code: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, code.trim());
}

export function clearInviteCode(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function getInviteStorageKey(): string {
  return STORAGE_KEY;
}
