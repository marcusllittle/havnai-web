export const SITE_NAME = "JoinHavn";
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://joinhavn.io").replace(/\/$/, "");
export const DEFAULT_OG_IMAGE = `${SITE_URL}/HavnAI-logo.png`;

export type SeoConfig = {
  title: string;
  description?: string;
  path?: string;
  image?: string;
  noindex?: boolean;
  type?: "website" | "article";
  canonicalUrl?: string;
};

export function buildTitle(title: string): string {
  if (!title.trim()) return SITE_NAME;
  if (title === SITE_NAME) return SITE_NAME;
  return `${title} | ${SITE_NAME}`;
}

export function absoluteUrl(path = "/"): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (!path.startsWith("/")) return `${SITE_URL}/${path}`;
  return `${SITE_URL}${path}`;
}

export function normalizeCanonical(path?: string, canonicalUrl?: string): string {
  if (canonicalUrl) return absoluteUrl(canonicalUrl);
  return absoluteUrl(path || "/");
}

export function normalizeImage(image?: string): string {
  return absoluteUrl(image || DEFAULT_OG_IMAGE);
}
