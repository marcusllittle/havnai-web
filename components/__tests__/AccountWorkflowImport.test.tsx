import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { WorkflowImport } from "../WorkflowImport";
const state = vi.hoisted(() => ({ account: { id: "alice" }, request: vi.fn(), legacy: vi.fn() }));
vi.mock("../AccountProvider", () => ({ useAccount: () => state }));
vi.mock("../../lib/havnai", () => ({ fetchWorkflow: state.legacy }));
let host: HTMLDivElement, root: Root;
const apply = vi.fn();
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); state.account = { id: "alice" }; apply.mockReset();
  state.request.mockReset().mockResolvedValue({ name: "Private setup", category: "Image Generation", config: { prompt_template: "secret" } }); state.legacy.mockReset();
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
it("loads a private account template and only applies on click", async () => {
  await act(async () => root.render(<WorkflowImport id="account:12" disabled={false} onApply={apply} />));
  expect(state.request).toHaveBeenCalledWith("/v2/account/workflows/12", expect.objectContaining({ signal: expect.any(AbortSignal) }));
  expect(state.legacy).not.toHaveBeenCalled(); expect(apply).not.toHaveBeenCalled();
  await act(async () => [...host.querySelectorAll("button")].find(button => button.textContent === "Apply template")!.click());
  expect(apply).toHaveBeenCalledWith(expect.objectContaining({ prompt: "secret" }));
});
it("clears a private template immediately on account change", async () => {
  await act(async () => root.render(<WorkflowImport id="account:12" disabled={false} onApply={apply} />));
  state.account = { id: "bob" }; state.request.mockImplementation(() => new Promise(() => {}));
  await act(async () => root.render(<WorkflowImport id="account:12" disabled={false} onApply={apply} />));
  expect(host.textContent).not.toContain("Private setup"); expect(apply).not.toHaveBeenCalled();
});
