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
  "faithful_square_i2v",
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
  const sourceAspect = sourceWidth / sourceHeight;
  const candidates = workflows.filter((workflow) => {
    const width = workflow.settings?.width || 0;
    const height = workflow.settings?.height || 0;
    return FIDELITY_WORKFLOW_IDS.has(workflow.id) && width > 0 && height > 0;
  });
  return candidates.reduce<VideoWorkflow | undefined>((closest, workflow) => {
    if (!closest) return workflow;
    const workflowAspect =
      (workflow.settings?.width || 1) / (workflow.settings?.height || 1);
    const closestAspect =
      (closest.settings?.width || 1) / (closest.settings?.height || 1);
    const distance = Math.abs(Math.log(sourceAspect / workflowAspect));
    const closestDistance = Math.abs(Math.log(sourceAspect / closestAspect));
    return distance < closestDistance ? workflow : closest;
  }, undefined);
};
