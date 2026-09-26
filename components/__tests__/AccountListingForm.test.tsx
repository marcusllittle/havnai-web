import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AccountListingForm } from "../AccountListingForm";
const job = { id: "job-one", owner_account_id: "alice", status: "succeeded", type: "image",
  resolved_spec: { parameters: { prompt: "Private prompt must not become the public title" } }, artifacts: [{ id: "art-one", kind: "image" }, { id: "art-two", kind: "image" }] };
let host: HTMLDivElement; let root: Root;
const request = vi.fn(); const complete = vi.fn(); const pendingChanged = vi.fn();
const render = () => act(async () => { root.render(<AccountListingForm account="alice" jobId="job-one" request={request} onComplete={complete} onClose={() => {}} onPendingChange={pendingChanged} />); });
const input = (name: string) => [...host.querySelectorAll("label")].find(el => el.textContent?.startsWith(name))!.querySelector<HTMLInputElement>("input")!;
const fill = async (name: string, value: string) => act(async () => {
  const target = input(name); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(target, value);
  target.dispatchEvent(new Event("input", { bubbles: true }));
});
const submit = () => host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); sessionStorage.clear(); complete.mockClear(); pendingChanged.mockClear();
  request.mockReset().mockImplementation(async (path: string, init?: RequestInit) => init?.method === "POST"
    ? { listing_id: 7, job_id: "job-one", price_units: JSON.parse(String(init.body)).price_units } : job);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); sessionStorage.clear(); vi.unstubAllGlobals(); });

it("publishes explicit public details and the chosen owned output without wallet data", async () => {
  await render();
  expect(input("Title").value).toBe("");
  expect(host.textContent).not.toContain("Private prompt must");
  await fill("Title", "Blue coast"); await fill("Price in credits", "1.001");
  await act(async () => { const select = host.querySelector("select")!; select.value = "art-two"; select.dispatchEvent(new Event("change", { bubbles: true })); });
  await act(async () => { submit(); submit(); });
  const posts = request.mock.calls.filter(([, init]) => init?.method === "POST");
  expect(posts).toHaveLength(1);
  expect(JSON.parse(posts[0][1].body)).toEqual({ job_id: "job-one", artifact_id: "art-two", title: "Blue coast", price_units: 1001, description: "", category: "" });
  expect(complete).toHaveBeenCalledWith({ listing_id: 7, job_id: "job-one", price_units: 1001 });
});

it("retains the original listing after a lost response and explicitly retries it", async () => {
  let failed = false;
  request.mockImplementation(async (_path: string, init?: RequestInit) => {
    if (init?.method !== "POST") return job;
    if (!failed) { failed = true; throw new Error("Connection lost"); }
    return { listing_id: 7, job_id: "job-one", price_units: 1000 };
  });
  await render(); await fill("Title", "Coast");
  await act(async () => { submit(); });
  expect(host.textContent).toContain("Connection lost");
  expect(host.querySelector("form")).toBeNull();
  await act(async () => [...host.querySelectorAll("button")].find(el => el.textContent === "Retry listing request")!.click());
  const posts = request.mock.calls.filter(([, init]) => init?.method === "POST");
  expect(posts).toHaveLength(2); expect(posts[1]).toEqual(posts[0]);
  expect(complete).toHaveBeenCalledTimes(1);
});

it.each([{ ...job, owner_account_id: "bob" }, { ...job, type: "face_swap" }, { ...job, status: "running" }, { ...job, artifacts: [] }])("rejects unowned or ineligible jobs", async value => {
  request.mockResolvedValue(value); await render();
  expect(host.querySelector("form")).toBeNull();
  expect(host.querySelector('[role="alert"]')).not.toBeNull();
  expect(request).toHaveBeenCalledTimes(1);
});

it("aborts an abandoned job lookup and never shows late private data", async () => {
  let resolve!: (value: unknown) => void;
  request.mockImplementation(() => new Promise(value => { resolve = value; }));
  await render(); const signal = request.mock.calls[0][1].signal;
  await act(async () => { root.render(<p>Another account</p>); resolve(job); });
  expect(signal.aborted).toBe(true); expect(host.textContent).toBe("Another account");
});

it("loads a persisted listing without submitting or replacing its reviewed details", async () => {
  const body = { job_id: "job-one", artifact_id: "art-two", title: "Original public title", price_units: 2001 };
  sessionStorage.setItem("havnai.account-marketplace-request.v1:alice", JSON.stringify({ key: "persisted-listing-key", kind: "list", body }));
  await render();
  expect(request).toHaveBeenCalledTimes(1);
  expect(host.textContent).toContain("Original public title: 2.001 credits");
  expect(host.querySelector("form")).toBeNull();
  await act(async () => [...host.querySelectorAll("button")].find(el => el.textContent === "Retry listing request")!.click());
  expect(JSON.parse(request.mock.calls[1][1].body)).toEqual(body);
  expect(request.mock.calls[1][1].headers["Idempotency-Key"]).toBe("persisted-listing-key");
});
