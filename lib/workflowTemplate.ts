import type { Workflow } from "./havnai";

export type WorkflowTemplate = {
  name: string;
  mode: "image" | "video" | "face_swap";
  model: string;
  prompt: string;
  negativePrompt: string;
  steps?: number;
  guidance?: number;
  additionalSettings: string[];
};

export function readWorkflowTemplate(workflow: Workflow): WorkflowTemplate {
  if (!workflow || typeof workflow.name !== "string" || !workflow.config || typeof workflow.config !== "object" || Array.isArray(workflow.config)) throw new Error("This template has an unreadable configuration.");
  const category = workflow.category || "Image Generation";
  const mode = category === "Image Generation" ? "image" : category === "Video Generation" ? "video" : category === "Face Swap" ? "face_swap" : null;
  if (!mode) throw new Error(`${category} templates cannot be applied in Create yet.`);
  const config: Record<string, unknown> = workflow.config;
  const readText = (key: string, fallback = "") => {
    const value = config[key];
    if (value == null) return fallback;
    if (typeof value !== "string") throw new Error(`The template's ${key.replaceAll("_", " ")} is invalid.`);
    return value.slice(0, 4000);
  };
  const readNumber = (key: string, min: number, max: number, integer: boolean) => {
    const value = config[key];
    if (value == null || value === "") return undefined;
    const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    if (!Number.isFinite(number) || number < min || number > max || (integer && !Number.isInteger(number))) throw new Error(`The template's ${key} is outside the supported range.`);
    return number;
  };
  return {
    name: workflow.name,
    mode,
    model: readText("model", "auto").trim() || "auto",
    prompt: readText("prompt_template"),
    negativePrompt: mode === "face_swap" ? "" : readText("negative_prompt"),
    steps: readNumber("steps", 1, 100, true),
    guidance: readNumber("guidance", 0, 30, false),
    additionalSettings: Object.keys(config).filter(key => !["model", "prompt_template", "negative_prompt", "steps", "guidance"].includes(key) || (mode === "face_swap" && key === "negative_prompt" && !!config[key])),
  };
}
