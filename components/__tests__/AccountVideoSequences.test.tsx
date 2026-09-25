import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { AccountVideoSequences } from "../AccountVideoSequences";
let host: HTMLDivElement, root: Root;
const request = vi.fn(), resume = vi.fn(), stop = vi.fn();
const chain = { id: "chain-one", owner_account_id: "alice", template: { prompt: "A coast" }, total: 2, auto_stitch: true, state: "active", jobs: [] };
const access = { request, signal: new AbortController().signal };
const button = (label: string) => [...host.querySelectorAll("button")].find(el => el.textContent?.trim() === label)!;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); request.mockReset(); resume.mockReset(); stop.mockReset();
  request.mockResolvedValue({ chains: [chain] });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
const render = () => act(async () => root.render(<AccountVideoSequences account="alice" access={access} revision={0} busy={false} onResume={resume} onStop={stop} />));

it("loads recovery plans only when opened and advances only on explicit resume", async () => {
  await render(); expect(request).not.toHaveBeenCalled();
  await act(async () => button("Saved video sequences").click());
  expect(host.textContent).toContain("A coast"); expect(resume).not.toHaveBeenCalled();
  expect(request.mock.calls[0][0]).toBe("/v2/video-chains?offset=0");
  await act(async () => button("Resume sequence").click()); expect(resume).toHaveBeenCalledWith("chain-one");
  await act(async () => button("Stop sequence").click()); expect(stop).toHaveBeenCalledWith("chain-one");
});

it("does not display a foreign account response", async () => {
  request.mockResolvedValue({ chains: [{ ...chain, owner_account_id: "bob" }] });
  await render(); await act(async () => button("Saved video sequences").click());
  expect(host.textContent).not.toContain("A coast"); expect(host.querySelector('[role="alert"]')).not.toBeNull();
  expect(button("Resume sequence")).toBeUndefined();
});

it("aborts pending recovery reads when closed", async () => {
  let finish!: (value: unknown) => void;
  request.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  await render(); await act(async () => button("Saved video sequences").click());
  const signal = request.mock.calls[0][1].signal;
  await act(async () => button("Saved video sequences").click());
  expect(signal.aborted).toBe(true);
  await act(async () => finish({ chains: [chain] }));
  expect(host.textContent).not.toContain("A coast");
});
