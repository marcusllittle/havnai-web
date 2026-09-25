import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { AccountWorkflowLibrary } from "../AccountWorkflowLibrary";
const state = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("../AccountProvider", () => ({ useAccount: () => state }));
vi.mock("next/link", () => ({ default: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} /> }));
let host: HTMLDivElement, root: Root;
const edit = vi.fn();
const item = { id: "12", name: "My template", description: "Private", config: { prompt_template: "hello" }, published: false };
const button = (label: string) => [...host.querySelectorAll("button")].find(node => node.textContent === label)!;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); edit.mockReset();
  state.request.mockReset().mockResolvedValue({ workflows: [item], total: 1 });
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
it("reads account templates and only publishes after an explicit click", async () => {
  await act(async () => root.render(<AccountWorkflowLibrary onEdit={edit} />));
  expect(state.request).toHaveBeenCalledTimes(1);
  expect(host.querySelector("a")?.getAttribute("href")).toBe("/create?workflow=account%3A12");
  await act(async () => button("Edit").click()); expect(edit).toHaveBeenCalledWith(item);
  await act(async () => button("Publish template").click());
  expect(state.request).toHaveBeenCalledWith("/v2/account/workflows/12", expect.objectContaining({ method: "PATCH", body: '{"published":true}' }));
});
it("requires a separate delete confirmation", async () => {
  await act(async () => root.render(<AccountWorkflowLibrary onEdit={edit} />));
  await act(async () => button("Delete").click()); expect(state.request).toHaveBeenCalledTimes(1);
  await act(async () => button("Confirm delete").click());
  expect(state.request).toHaveBeenCalledWith("/v2/account/workflows/12", expect.objectContaining({ method: "DELETE" }));
});
it("aborts private inventory requests when the account changes", async () => {
  state.request.mockImplementation(() => new Promise(() => {}));
  await act(async () => root.render(<AccountWorkflowLibrary onEdit={edit} />));
  const signal = state.request.mock.calls[0][1].signal;
  await act(async () => root.render(<div>Signed out</div>));
  expect(signal.aborted).toBe(true); expect(host.textContent).toBe("Signed out");
});
