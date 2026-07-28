export const SITE_NAME = "JoinHavn";
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://joinhavn.io").replace(/\/$/, "");
export const DEFAULT_OG_IMAGE = "/astra/scenes/nebula_runway_briefing.png";
export const DEFAULT_OG_IMAGE_ALT = "JoinHavn sci-fi scene with pilots, ships, and creation flow";

type SocialImageConfig = {
  image: string;
  alt: string;
};

const PAGE_SOCIAL_IMAGES: Record<string, SocialImageConfig> = {
  "/": {
    image: "/astra/scenes/nebula_runway_briefing.png",
    alt: "JoinHavn homepage preview with sci-fi world artwork",
  },
  "/astra": {
    image: "/astra/scenes/shmup_combat.png",
    alt: "Astra Valkyries combat preview",
  },
  "/create": {
    image: "/astra/scenes/abyss_crown_briefing.png",
    alt: "JoinHavn create page preview with Astra mission artwork",
  },
  "/ai-image-generator": {
    image: "/astra/scenes/nebula_runway_briefing.png",
    alt: "AI image generator preview with JoinHavn sci-fi scene",
  },
  "/ai-video-generator": {
    image: "/astra/scenes/solar_rift_briefing.png",
    alt: "AI video generator preview with JoinHavn cinematic sci-fi artwork",
  },
  "/how-it-works": {
    image: "/astra/scenes/spaceport_hub.png",
    alt: "How JoinHavn works preview showing the Astra spaceport hub",
  },
  "/ownership": {
    image: "/astra/inbox/nova_after_hours.png",
    alt: "JoinHavn ownership preview with collectible asset artwork",
  },
  "/run-a-node": {
    image: "/astra/scenes/spaceport_hub.png",
    alt: "Run a node preview with JoinHavn network-themed artwork",
  },
  "/join": {
    image: "/astra/scenes/spaceport_hub.png",
    alt: "Run a node preview with JoinHavn network-themed artwork",
  },
  "/marketplace": {
    image: "/astra/inbox/nova_after_hours.png",
    alt: "JoinHavn marketplace preview with collectible asset artwork",
  },
  "/pricing": {
    image: "/astra/scenes/solar_rift_briefing.png",
    alt: "JoinHavn pricing preview with sci-fi mission artwork",
  },
  "/nodes": {
    image: "/astra/scenes/spaceport_hub.png",
    alt: "JoinHavn GPU node network preview",
  },
};

export type SeoConfig = {
  title: string;
  description?: string;
  path?: string;
  image?: string;
  imageAlt?: string;
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

export function getDefaultSocialImage(path?: string): SocialImageConfig {
  return (path && PAGE_SOCIAL_IMAGES[path]) || {
    image: DEFAULT_OG_IMAGE,
    alt: DEFAULT_OG_IMAGE_ALT,
  };
}

export function normalizeImage(image?: string, path?: string): string {
  return absoluteUrl(image || getDefaultSocialImage(path).image);
}

export function normalizeImageAlt(imageAlt?: string, path?: string): string {
  return imageAlt || getDefaultSocialImage(path).alt;
}
