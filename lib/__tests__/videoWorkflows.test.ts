import { describe, expect, it } from "vitest";
import {
  getPreferredVideoWorkflow,
  getSourceOrientedFidelityWorkflow,
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

describe("getSourceOrientedFidelityWorkflow", () => {
  const workflows: VideoWorkflow[] = [
    { id: "faithful_i2v", label: "Maximum fidelity" },
    { id: "faithful_portrait_i2v", label: "Maximum fidelity - Portrait" },
    { id: "balanced_i2v", label: "Balanced motion" },
  ];

  it("selects portrait fidelity for a portrait source", () => {
    expect(
      getSourceOrientedFidelityWorkflow(workflows, 832, 1216, "faithful_i2v")?.id
    ).toBe("faithful_portrait_i2v");
  });

  it("selects landscape fidelity for a landscape source", () => {
    expect(
      getSourceOrientedFidelityWorkflow(
        workflows,
        1216,
        832,
        "faithful_portrait_i2v"
      )?.id
    ).toBe("faithful_i2v");
  });

  it("does not replace an explicit non-fidelity workflow", () => {
    expect(
      getSourceOrientedFidelityWorkflow(workflows, 832, 1216, "balanced_i2v")
    ).toBeUndefined();
  });

  it("does not replace an explicit custom workflow", () => {
    expect(
      getSourceOrientedFidelityWorkflow(workflows, 832, 1216, "")
    ).toBeUndefined();
  });

  it("does not guess an orientation for a square or invalid source", () => {
    expect(
      getSourceOrientedFidelityWorkflow(workflows, 1024, 1024, "faithful_i2v")
    ).toBeUndefined();
    expect(
      getSourceOrientedFidelityWorkflow(workflows, 0, 1024, "faithful_i2v")
    ).toBeUndefined();
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
