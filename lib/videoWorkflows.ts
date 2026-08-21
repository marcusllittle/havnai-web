export type VideoWorkflowSettings = {
  steps?: number;
  guidance?: number;
  width?: number;
  height?: number;
  frames?: number;
  fps?: number;
  strength?: number;
  lora_strength?: number;
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
