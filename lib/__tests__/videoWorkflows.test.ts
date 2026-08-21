import { describe, expect, it } from "vitest";
import {
  getPreferredVideoWorkflow,
  isVideoWorkflowInitImageMissing,
  type VideoWorkflow,
} from "../videoWorkflows";

describe("getPreferredVideoWorkflow", () => {
  it("uses the manifest default even when it is not first", () => {
    const workflows: VideoWorkflow[] = [
      { id: "dynamic", label: "Dynamic" },
      { id: "faithful", label: "Faithful", default: true },
    ];

    expect(getPreferredVideoWorkflow(workflows)?.id).toBe("faithful");
  });

  it("falls back to the first advertised workflow", () => {
    const workflows: VideoWorkflow[] = [{ id: "balanced", label: "Balanced" }];

    expect(getPreferredVideoWorkflow(workflows)?.id).toBe("balanced");
  });
});

describe("isVideoWorkflowInitImageMissing", () => {
  const workflow: VideoWorkflow = {
    id: "faithful",
    label: "Faithful",
    requires_init_image: true,
  };

  it("reports a missing required source", () => {
    expect(isVideoWorkflowInitImageMissing(workflow, undefined)).toBe(true);
    expect(isVideoWorkflowInitImageMissing(workflow, "   ")).toBe(true);
  });

  it("accepts an uploaded or URL source", () => {
    expect(isVideoWorkflowInitImageMissing(workflow, "data:image/png;base64,abc")).toBe(false);
    expect(isVideoWorkflowInitImageMissing(workflow, "https://example.com/source.png")).toBe(false);
  });

  it("does not require a source for other workflows", () => {
    expect(
      isVideoWorkflowInitImageMissing(
        { id: "text", label: "Text to video" },
        undefined
      )
    ).toBe(false);
  });
});
