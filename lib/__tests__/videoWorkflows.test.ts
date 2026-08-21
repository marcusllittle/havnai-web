import { describe, expect, it } from "vitest";
import { getPreferredVideoWorkflow, type VideoWorkflow } from "../videoWorkflows";

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
