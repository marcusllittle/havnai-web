import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TemplatesPage from "../../pages/templates";
import * as api from "../../lib/havnai";
import { readWorkflowTemplate } from "../../lib/workflowTemplate";
import { getServerSideProps } from "../../pages/generator";

const { account } = vi.hoisted(() => ({ account: { account: null as { id: string } | null, request: vi.fn() } }));
vi.mock("../SiteHeader", () => ({ SiteHeader: () => null }));
vi.mock("../SeoHead", () => ({ SeoHead: () => null }));
vi.mock("../AccountProvider", () => ({ useAccount: () => account }));
vi.mock("../AccountWorkflowLibrary", () => ({ AccountWorkflowLibrary: () => null }));
vi.mock("../../lib/havnai", async original => ({ ...await original<typeof import("../../lib/havnai")>(), fetchMarketplace: vi.fn(), createWorkflow: vi.fn() }));

const template: api.Workflow = { id: "4", name: "Soft portraits", description: "Warm editorial light", category: "Image Generation", config: { model: "auto", prompt_template: "A portrait of {subject}", steps: 28, guidance: 6 }, creator_wallet: "0x1111111111111111111111111111111111111111", usage_count: 9, published: true, created_at: "2026-09-17", updated_at: "2026-09-17" };
const catalog = (items = [template]) => ({ workflows: items, total: items.length, offset: 0, limit: 12 });

describe("Template experience", () => {
  let container: HTMLDivElement, root: Root;
  const button = (label: string) => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(item => item.textContent?.trim() === label)!;
  const render = () => act(async () => root.render(<TemplatesPage />));
  function change(selector: string, value: string) {
    const input = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
    const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    account.account = null; account.request.mockReset().mockResolvedValue(template);
    vi.mocked(api.fetchMarketplace).mockResolvedValue(catalog());
    vi.mocked(api.createWorkflow).mockResolvedValue(template);
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.clearAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

  it("distinguishes catalog errors from empty results and retries", async () => {
    vi.mocked(api.fetchMarketplace).mockRejectedValueOnce(new Error("Offline"));
    await render();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.textContent).not.toContain("catalog is empty");
    await act(async () => button("Try again").click());
    expect(container.querySelector(".template-card")?.textContent).toContain("Soft portraits");
  });

  it("debounces search and rejects an older catalog response", async () => {
    vi.useFakeTimers();
    let resolveOld!: (value: api.WorkflowListResponse) => void;
    vi.mocked(api.fetchMarketplace).mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
    await render();
    await act(async () => change('[aria-label="Search templates"]', "coast"));
    expect(api.fetchMarketplace).toHaveBeenCalledTimes(1);
    vi.mocked(api.fetchMarketplace).mockResolvedValue(catalog([{ ...template, id: "5", name: "Quiet coast" }]));
    await act(async () => vi.advanceTimersByTimeAsync(300));
    expect(api.fetchMarketplace).toHaveBeenLastCalledWith(expect.objectContaining({ search: "coast", offset: 0 }));
    await act(async () => resolveOld(catalog()));
    expect(container.querySelector(".template-card")?.textContent).toContain("Quiet coast");
  });

  it("preserves a failed draft and saves with the current account without publishing", async () => {
    account.account = { id: "alice" };
    account.request.mockRejectedValueOnce(new Error("Offline"));
    await render();
    await act(async () => button("New template").click());
    await act(async () => { change('input[maxlength="160"]', "My template"); change('textarea[rows="5"]', "A warm portrait"); });
    await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(container.textContent).toContain("Your draft is still here");
    expect(container.querySelector<HTMLInputElement>('input[maxlength="160"]')!.value).toBe("My template");
    await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    const [path, init] = account.request.mock.calls.at(-1)!;
    expect(path).toBe("/v2/account/workflows");
    expect(JSON.parse(init.body)).toMatchObject({ name: "My template", config: { prompt_template: "A warm portrait", steps: 28, guidance: 6 } });
    expect(JSON.parse(init.body)).not.toHaveProperty("published");
    expect(api.createWorkflow).not.toHaveBeenCalled();
    expect(container.querySelector('.template-saved a')?.getAttribute("href")).toBe("/create?workflow=account%3A4");
    expect(button("Saved").disabled).toBe(true);
  });

  it("ignores a save completion and clears the draft after the account changes", async () => {
    account.account = { id: "alice" };
    let finish!: (value: api.Workflow) => void;
    account.request.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await render(); await act(async () => button("New template").click());
    await act(async () => change('input[maxlength="160"]', "Keep this draft"));
    await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    account.account = { id: "bob" };
    await render(); await act(async () => finish(template));
    expect(container.querySelector(".template-saved")).toBeNull();
    await act(async () => button("New template").click());
    expect(container.querySelector<HTMLInputElement>('input[maxlength="160"]')!.value).toBe("");
  });

  it("rejects unsupported categories and invalid settings, and reports unimported fields", () => {
    expect(() => readWorkflowTemplate({ ...template, category: "Upscaling" })).toThrow("cannot be applied");
    expect(() => readWorkflowTemplate({ ...template, config: { steps: -1 } })).toThrow("outside the supported range");
    expect(readWorkflowTemplate({ ...template, category: "Face Swap", config: { negative_prompt: "blur", custom: true } })).toMatchObject({ negativePrompt: "", additionalSettings: ["negative_prompt", "custom"] });
  });

  it("preserves the selected workflow in legacy generator links", async () => {
    const result = await getServerSideProps({ query: { workflow: "4" } } as never);
    expect(result).toEqual({ redirect: { destination: "/create?workflow=4", permanent: true } });
  });
});
