import { describe, expect, it } from "vitest";
import { buildModelOptionLabel, resolveCanonicalTier, tierFromWeight } from "../modelMetadata";

describe("model metadata canonical display", () => {
  it("preserves canonical model identity for similarly named variants", () => {
    const sdxlLabel = buildModelOptionLabel(
      { name: "perfectdeliberate_v60", tier: "D", reward_weight: 3 },
      "SDXL"
    );
    const sd15Label = buildModelOptionLabel(
      { name: "perfectdeliberate_v5SD15", tier: "A", reward_weight: 10 },
      "SD15"
    );

    expect(sdxlLabel).toContain("perfectdeliberate_v60");
    expect(sd15Label).toContain("perfectdeliberate_v5SD15");
    expect(sdxlLabel).not.toEqual(sd15Label);
  });

  it("uses backend tier as source-of-truth when present", () => {
    const tier = resolveCanonicalTier({
      name: "perfectdeliberate_v60",
      tier: "A",
      reward_weight: 3,
    });
    expect(tier).toBe("A");
  });

  it("falls back to reward_weight-based tiering when backend tier is absent", () => {
    expect(resolveCanonicalTier({ name: "ltx2", reward_weight: 20 })).toBe("S");
    expect(resolveCanonicalTier({ name: "epicrealism", reward_weight: 10 })).toBe("A");
    expect(resolveCanonicalTier({ name: "experimental", weight: 3 })).toBe("D");
    expect(tierFromWeight(8)).toBe("B");
  });
});
