export type CanonicalTier = "S" | "A" | "B" | "C" | "D";

function normalizeTier(raw: unknown): CanonicalTier | null {
  const value = String(raw || "").trim().toUpperCase();
  if (value === "S" || value === "A" || value === "B" || value === "C" || value === "D") {
    return value;
  }
  return null;
}

export function tierFromWeight(weight: number): CanonicalTier {
  if (weight >= 20) return "S";
  if (weight >= 10) return "A";
  if (weight >= 8) return "B";
  if (weight >= 5) return "C";
  return "D";
}

export interface CanonicalModelMetadataLike {
  name?: string;
  tier?: string;
  reward_weight?: number;
  weight?: number;
}

export function resolveCanonicalTier(entry: CanonicalModelMetadataLike): CanonicalTier {
  const backendTier = normalizeTier(entry?.tier);
  if (backendTier) return backendTier;

  const preferredWeight = Number(entry?.reward_weight);
  if (Number.isFinite(preferredWeight)) {
    return tierFromWeight(preferredWeight);
  }
  const fallbackWeight = Number(entry?.weight);
  if (Number.isFinite(fallbackWeight)) {
    return tierFromWeight(fallbackWeight);
  }
  return "D";
}

export function canonicalModelName(name: unknown): string {
  return String(name || "").trim();
}

export function buildModelOptionLabel(
  entry: CanonicalModelMetadataLike,
  descriptor: string
): string {
  const name = canonicalModelName(entry?.name);
  const tier = resolveCanonicalTier(entry);
  const descriptorLabel = String(descriptor || "").trim();
  if (!descriptorLabel) return `${name} · Tier ${tier}`;
  return `${name} · Tier ${tier} · ${descriptorLabel}`;
}
