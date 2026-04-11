import { describe, expect, it } from "vitest";
import {
  deriveCatalogModelsFromWorkers,
  mergeGeneratorCatalogModels,
  normalizeGeneratorCatalogModels,
  partitionGeneratorModels,
} from "../generatorModelCatalog";

describe("partitionGeneratorModels", () => {
  it("prefers explicitly labeled SDXL image models when present", () => {
    const models = [
      {
        name: "perfectdeliberate_v60",
        available: true,
        task_type: "IMAGE_GEN",
        pipeline: "sdxl",
      },
      {
        name: "epicrealismXL_vxviiCrystalclear",
        available: true,
        task_type: "FACE_SWAP",
        pipeline: "sdxl_faceswap",
        face_swap_available: true,
      },
      {
        name: "ltx_video_dev",
        available: true,
        task_type: "LTX_VIDEO_GEN",
        model_family: "ltx_video",
      },
    ];

    const result = partitionGeneratorModels(models);

    expect(result.imageModels.map((entry) => entry.name)).toEqual([
      "perfectdeliberate_v60",
      "epicrealismXL_vxviiCrystalclear",
    ]);
    expect(result.videoModels.map((entry) => entry.name)).toEqual(["ltx_video_dev"]);
    expect(result.faceSwapModels.map((entry) => entry.name)).toEqual([
      "epicrealismXL_vxviiCrystalclear",
    ]);
  });

  it("falls back to image-capable models when strict SDXL metadata is missing", () => {
    const models = [
      {
        name: "perfectdeliberate_v60",
        available: true,
        task_type: "IMAGE_GEN",
        image_defaults: { steps: 30 },
      },
      {
        name: "epicrealismXL_vxviiCrystalclear",
        available: true,
        task_type: "FACE_SWAP",
        face_swap_available: true,
      },
      {
        name: "ltx_video_dev",
        available: true,
        task_type: "VIDEO_GEN",
      },
    ];

    const result = partitionGeneratorModels(models);

    expect(result.imageModels.map((entry) => entry.name)).toEqual([
      "perfectdeliberate_v60",
      "epicrealismXL_vxviiCrystalclear",
    ]);
    expect(result.faceSwapModels.map((entry) => entry.name)).toEqual([
      "epicrealismXL_vxviiCrystalclear",
    ]);
    expect(result.videoModels.map((entry) => entry.name)).toEqual(["ltx_video_dev"]);
  });

  it("normalizes object-shaped catalogs and truthy string flags", () => {
    const models = normalizeGeneratorCatalogModels({
      perfect: {
        model: "perfectdeliberate_v60",
        available: "true",
        task_type: "IMAGE_GEN",
        pipeline: "sdxl",
      },
    });

    const result = partitionGeneratorModels(models);

    expect(result.imageModels.map((entry) => entry.name)).toEqual(["perfectdeliberate_v60"]);
  });

  it("merges live worker inventory when model metadata is incomplete", () => {
    const primaryModels = normalizeGeneratorCatalogModels([
      {
        name: "perfectdeliberate_v60",
        available: "false",
      },
    ]);
    const workerModels = deriveCatalogModelsFromWorkers([
      {
        online: true,
        supported_job_types: ["IMAGE_GEN", "FACE_SWAP"],
        models: ["perfectdeliberate_v60", "epicrealismXL_vxviiCrystalclear"],
        pipelines: ["sdxl", "sdxl"],
      },
    ]);

    const merged = mergeGeneratorCatalogModels(primaryModels, workerModels);
    const result = partitionGeneratorModels(merged);

    expect(result.imageModels.map((entry) => entry.name)).toEqual([
      "perfectdeliberate_v60",
      "epicrealismXL_vxviiCrystalclear",
    ]);
    expect(result.faceSwapModels.map((entry) => entry.name)).toEqual([
      "perfectdeliberate_v60",
      "epicrealismXL_vxviiCrystalclear",
    ]);
  });
});
