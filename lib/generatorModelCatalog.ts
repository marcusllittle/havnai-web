export interface GeneratorCatalogModelLike {
  name?: string;
  available?: boolean;
  task_type?: string | null;
  pipeline?: string | null;
  model_family?: string | null;
  face_swap_available?: boolean;
  image_defaults?: object | null;
  face_swap_defaults?: object | null;
}

const VIDEO_TASK_TYPES = new Set(["VIDEO_GEN", "ANIMATEDIFF", "LTX_VIDEO_GEN"]);
const IMAGE_TASK_TYPES = new Set(["IMAGE_GEN", "TXT2IMG", "IMG2IMG", "INPAINT"]);

function normalizeTaskType(value: unknown): string {
  return String(value || "").trim().toUpperCase();
}

function normalizeToken(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function isVideoModel(entry: GeneratorCatalogModelLike): boolean {
  const taskType = normalizeTaskType(entry.task_type);
  const modelFamily = normalizeToken(entry.model_family);
  return VIDEO_TASK_TYPES.has(taskType) || modelFamily === "ltx_video";
}

function isStrictSdxlImageModel(entry: GeneratorCatalogModelLike): boolean {
  if (entry.available !== true) return false;
  if (isVideoModel(entry)) return false;

  const taskType = normalizeTaskType(entry.task_type);
  const pipeline = normalizeToken(entry.pipeline);

  if (!(IMAGE_TASK_TYPES.has(taskType) || taskType === "FACE_SWAP" || !taskType)) return false;
  return pipeline.includes("sdxl");
}

function isFallbackImageModel(entry: GeneratorCatalogModelLike): boolean {
  if (entry.available !== true) return false;
  if (isVideoModel(entry)) return false;

  const taskType = normalizeTaskType(entry.task_type);
  return (
    IMAGE_TASK_TYPES.has(taskType) ||
    taskType === "FACE_SWAP" ||
    !taskType ||
    entry.image_defaults != null ||
    entry.face_swap_defaults != null ||
    entry.face_swap_available === true
  );
}

function isStrictFaceSwapModel(entry: GeneratorCatalogModelLike): boolean {
  return isStrictSdxlImageModel(entry) && entry.face_swap_available === true;
}

function isFallbackFaceSwapModel(entry: GeneratorCatalogModelLike): boolean {
  if (!isFallbackImageModel(entry)) return false;
  const taskType = normalizeTaskType(entry.task_type);
  return taskType === "FACE_SWAP" || entry.face_swap_available === true || entry.face_swap_defaults != null;
}

export function partitionGeneratorModels<T extends GeneratorCatalogModelLike>(models: T[]): {
  imageModels: T[];
  videoModels: T[];
  faceSwapModels: T[];
} {
  const videoModels = models.filter((entry) => entry.available === true && isVideoModel(entry));

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
