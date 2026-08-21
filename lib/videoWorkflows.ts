export type VideoWorkflowSettings = {
  steps?: number;
  guidance?: number;
  width?: number;
  height?: number;
  frames?: number;
  fps?: number;
  strength?: number;
  lora_strength?: number;
  prompt_enhancer?: "T" | "TI" | "T1" | "TI1";
};

export type VideoWorkflow = {
  id: string;
  label: string;
  description?: string;
  default?: boolean;
  requires_init_image?: boolean;
  settings?: VideoWorkflowSettings;
};

export const getPreferredVideoWorkflow = (
  workflows?: VideoWorkflow[] | null
): VideoWorkflow | undefined => {
  if (!workflows?.length) return undefined;
  return workflows.find((workflow) => workflow.default) || workflows[0];
};

export const isVideoWorkflowInitImageMissing = (
  workflow: VideoWorkflow | undefined,
  initImage: string | undefined
): boolean => Boolean(workflow?.requires_init_image && !initImage?.trim());

const FIDELITY_WORKFLOW_IDS = new Set([
  "faithful_i2v",
  "faithful_portrait_i2v",
]);

export const getSourceOrientedFidelityWorkflow = (
  workflows: VideoWorkflow[] | null | undefined,
  sourceWidth: number,
  sourceHeight: number,
  selectedWorkflowId?: string
): VideoWorkflow | undefined => {
  if (!workflows?.length || sourceWidth <= 0 || sourceHeight <= 0) return undefined;
  if (!selectedWorkflowId || !FIDELITY_WORKFLOW_IDS.has(selectedWorkflowId)) {
    return undefined;
  }
  if (sourceWidth === sourceHeight) return undefined;

  const targetId =
    sourceHeight > sourceWidth ? "faithful_portrait_i2v" : "faithful_i2v";
  return workflows.find((workflow) => workflow.id === targetId);
};
