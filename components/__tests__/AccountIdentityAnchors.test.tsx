import React, { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AccountIdentityAnchors } from "../AccountIdentityAnchors";

let host: HTMLDivElement, root: Root;
const request = vi.fn(), onUse = vi.fn();
let access: { request: any; signal: AbortSignal };
const anchor = { slug: "pilot", display_name: "Pilot", asset_id: "asset-face" };
const button = (label: string) => [...host.querySelectorAll("button")].find(el => el.textContent?.trim() === label)!;
const setText = (id: string, value: string) => {
  const input = host.querySelector<HTMLInputElement>(id)!;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
};
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); request.mockReset(); onUse.mockReset();
  access = { request, signal: new AbortController().signal };
  request.mockResolvedValue({ anchors: [anchor] });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

it("loads only on demand and uses the selected account anchor", async () => {
  await act(async () => root.render(<StrictMode><AccountIdentityAnchors access={access} onUse={onUse} /></StrictMode>));
  expect(request).not.toHaveBeenCalled();
  await act(async () => button("Saved faces").click());
  await act(async () => button("Use Pilot").click());
  expect(onUse).toHaveBeenCalledWith("pilot");
  const signal = request.mock.calls[0][1].signal;
  await act(async () => button("Saved faces").click());
  expect(signal.aborted).toBe(true);
});

it("retries a lost save with the same asset and retains an anchor after rejected removal", async () => {
  let saved = false, attempts = 0;
  request.mockImplementation(async (path: string, init: RequestInit) => {
    if (path === "/v2/assets") return { id: "asset-face", kind: "image" };
    if (init.method === "PUT") { if (++attempts === 1) throw new Error("Connection lost"); saved = true; return anchor; }
    if (init.method === "DELETE") throw new Error("Removal failed");
    return { anchors: saved ? [anchor] : [] };
  });
  await act(async () => root.render(<AccountIdentityAnchors access={access} onUse={onUse} />));
  await act(async () => button("Saved faces").click());
  await act(async () => {
    setText("#anchor-name", "Pilot"); setText("#anchor-slug", "pilot");
    const input = host.querySelector<HTMLInputElement>("#anchor-file")!;
    Object.defineProperty(input, "files", { value: [new File(["face"], "face.png", { type: "image/png" })] });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await act(async () => { button("Save face").click(); button("Save face").click(); });
  expect(host.textContent).toContain("Connection lost");
  await act(async () => button("Save face").click());
  expect(request.mock.calls.filter(([path]) => path === "/v2/assets")).toHaveLength(1);
  const puts = request.mock.calls.filter(([, init]) => init.method === "PUT");
  expect(puts).toHaveLength(2); expect(puts[0][1].body).toBe(puts[1][1].body);
  await act(async () => button("Remove Pilot").click());
  expect(host.textContent).toContain("Removal failed");
  expect(button("Use Pilot")).toBeDefined();
});

it("aborts an unfinished account read on unmount", async () => {
  let finish!: (data: unknown) => void;
  request.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  await act(async () => root.render(<AccountIdentityAnchors access={access} onUse={onUse} />));
  await act(async () => button("Saved faces").click());
  const signal = request.mock.calls[0][1].signal;
  await act(async () => root.render(<p>Signed out</p>));
  expect(signal.aborted).toBe(true);
  await act(async () => finish({ anchors: [anchor] }));
  expect(host.textContent).toBe("Signed out");
});
