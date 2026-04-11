export interface GeneratorCatalogModelLike {
  model?: string;
  model_name?: string;
  model_key?: string;
  name?: string;
  available?: boolean | string | number | null;
  task_type?: string | null;
  pipeline?: string | null;
  model_family?: string | null;
  face_swap_available?: boolean | string | number | null;
  image_defaults?: object | null;
  face_swap_defaults?: object | null;
}

export interface GeneratorWorkerLike {
  online?: boolean | string | number | null;
  status?: string | null;
  supports?: string[] | null;
  supported_job_types?: string[] | null;
  models?: string[] | null;
  pipelines?: string[] | null;
}

const VIDEO_TASK_TYPES = new Set(["VIDEO_GEN", "ANIMATEDIFF", "LTX_VIDEO_GEN"]);
const IMAGE_TASK_TYPES = new Set(["IMAGE_GEN", "TXT2IMG", "IMG2IMG", "INPAINT"]);

function normalizeTaskType(value: unknown): string {
  return String(value || "").trim().toUpperCase();
}

function normalizeToken(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function normalizeModelName(entry: GeneratorCatalogModelLike): string {
  return String(entry.name || entry.model || entry.model_name || entry.model_key || "").trim();
}

function isTruthyFlag(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = normalizeToken(value);
  return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "online";
}

function isAvailable(entry: GeneratorCatalogModelLike): boolean {
  if (entry.available == null || entry.available === "") return true;
  return isTruthyFlag(entry.available);
}

function isVideoModel(entry: GeneratorCatalogModelLike): boolean {
  const taskType = normalizeTaskType(entry.task_type);
  const modelFamily = normalizeToken(entry.model_family);
  return VIDEO_TASK_TYPES.has(taskType) || modelFamily === "ltx_video";
}

function isStrictSdxlImageModel(entry: GeneratorCatalogModelLike): boolean {
  if (!isAvailable(entry)) return false;
  if (isVideoModel(entry)) return false;

  const taskType = normalizeTaskType(entry.task_type);
  const pipeline = normalizeToken(entry.pipeline);

  if (!(IMAGE_TASK_TYPES.has(taskType) || taskType === "FACE_SWAP" || !taskType)) return false;
  return pipeline.includes("sdxl");
}

function isFallbackImageModel(entry: GeneratorCatalogModelLike): boolean {
  if (!isAvailable(entry)) return false;
  if (isVideoModel(entry)) return false;

  const taskType = normalizeTaskType(entry.task_type);
  return (
    IMAGE_TASK_TYPES.has(taskType) ||
    taskType === "FACE_SWAP" ||
    !taskType ||
    entry.image_defaults != null ||
    entry.face_swap_defaults != null ||
    isTruthyFlag(entry.face_swap_available)
  );
}

function isStrictFaceSwapModel(entry: GeneratorCatalogModelLike): boolean {
  return isStrictSdxlImageModel(entry) && isTruthyFlag(entry.face_swap_available);
}

function isFallbackFaceSwapModel(entry: GeneratorCatalogModelLike): boolean {
  if (!isFallbackImageModel(entry)) return false;
  const taskType = normalizeTaskType(entry.task_type);
  return taskType === "FACE_SWAP" || isTruthyFlag(entry.face_swap_available) || entry.face_swap_defaults != null;
}

export function normalizeGeneratorCatalogModels(raw: unknown): GeneratorCatalogModelLike[] {
  const rawEntries = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
      ? Object.values(raw as Record<string, unknown>)
      : [];

  return rawEntries
    .filter((entry): entry is GeneratorCatalogModelLike => Boolean(entry) && typeof entry === "object")
    .map((entry) => {
      const name = normalizeModelName(entry);
      return {
        ...entry,
        name,
      };
    })
    .filter((entry) => entry.name.length > 0);
}

export function deriveCatalogModelsFromWorkers<T extends GeneratorWorkerLike>(
  workers: T[]
): GeneratorCatalogModelLike[] {
  const catalog = new Map<string, GeneratorCatalogModelLike>();

  for (const worker of workers) {
    const online =
      worker.online == null
        ? normalizeToken(worker.status) === "online"
        : isTruthyFlag(worker.online);
    if (!online) continue;

    const models = Array.isArray(worker.models) ? worker.models : [];
    if (models.length === 0) continue;

    const pipelines = Array.isArray(worker.pipelines) ? worker.pipelines : [];
    const supportedJobTypes = new Set(
      (Array.isArray(worker.supported_job_types) ? worker.supported_job_types : []).map((value) =>
        normalizeTaskType(value)
      )
    );
    const supports = new Set(
      (Array.isArray(worker.supports) ? worker.supports : []).map((value) => normalizeToken(value))
    );

    const hasImageSupport =
      supportedJobTypes.has("IMAGE_GEN") ||
      supportedJobTypes.has("FACE_SWAP") ||
      supports.has("image") ||
      supports.has("face_swap");
    const hasFaceSwapSupport =
      supportedJobTypes.has("FACE_SWAP") || supports.has("face_swap");
    const hasVideoSupport =
      supportedJobTypes.has("VIDEO_GEN") ||
      supportedJobTypes.has("ANIMATEDIFF") ||
      supportedJobTypes.has("LTX_VIDEO_GEN") ||
      supports.has("video");

    for (let index = 0; index < models.length; index += 1) {
      const rawName = String(models[index] || "").trim();
      if (!rawName) continue;
      const key = rawName.toLowerCase();
      const pipeline = String(pipelines[index] || pipelines[0] || "").trim();
      const existing = catalog.get(key) || { name: rawName };

      const next: GeneratorCatalogModelLike = {
        ...existing,
        name: existing.name || rawName,
        available: true,
      };

      if (pipeline && !next.pipeline) {
        next.pipeline = pipeline;
      }

      if (hasVideoSupport) {
        if (supportedJobTypes.has("LTX_VIDEO_GEN")) next.task_type = "LTX_VIDEO_GEN";
        else if (supportedJobTypes.has("ANIMATEDIFF")) next.task_type = "ANIMATEDIFF";
        else next.task_type = "VIDEO_GEN";
      } else if (hasImageSupport && !next.task_type) {
        next.task_type = hasFaceSwapSupport ? "FACE_SWAP" : "IMAGE_GEN";
      }

      if (hasFaceSwapSupport) {
        next.face_swap_available = true;
      }

      catalog.set(key, next);
    }
  }

  return Array.from(catalog.values());
}

export function mergeGeneratorCatalogModels<T extends GeneratorCatalogModelLike>(
  primaryModels: T[],
  fallbackModels: GeneratorCatalogModelLike[]
): T[] {
  const merged = new Map<string, T>();

  for (const model of primaryModels) {
    const name = normalizeModelName(model);
    if (!name) continue;
    merged.set(name.toLowerCase(), {
      ...model,
      name,
    });
  }

  for (const fallback of fallbackModels) {
    const name = normalizeModelName(fallback);
    if (!name) continue;
    const key = name.toLowerCase();
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, {
        ...(fallback as T),
        name,
      });
      continue;
    }
    merged.set(key, {
      ...existing,
      available: fallback.available ?? existing.available,
      task_type: existing.task_type || fallback.task_type,
      pipeline: existing.pipeline || fallback.pipeline,
      model_family: existing.model_family || fallback.model_family,
      face_swap_available:
        existing.face_swap_available ?? fallback.face_swap_available,
    });
  }

  return Array.from(merged.values());
}

export function partitionGeneratorModels<T extends GeneratorCatalogModelLike>(models: T[]): {
  imageModels: T[];
  videoModels: T[];
  faceSwapModels: T[];
} {
  const videoModels = models.filter((entry) => isAvailable(entry) && isVideoModel(entry));

  const strictImageModels = models.filter(isStrictSdxlImageModel);
  const imageModels = strictImageModels.length > 0
    ? strictImageModels
    : models.filter(isFallbackImageModel);

  const strictFaceSwapModels = models.filter(isStrictFaceSwapModel);
  const faceSwapModels = strictFaceSwapModels.length > 0
    ? strictFaceSwapModels
    : models.filter(isFallbackFaceSwapModel);

  return { imageModels, videoModels, faceSwapModels };
}
