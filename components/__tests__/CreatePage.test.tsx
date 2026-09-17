import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CreatePage from "../../pages/create";
import { ACTIVE_CREATE_JOB_KEY } from "../../lib/activeCreateJob";

const { router, walletState } = vi.hoisted(() => ({ router: { isReady: true, query: {} as Record<string, string | string[]> }, walletState: { activeWallet: null as string | null, connect: vi.fn() } }));
vi.mock("next/router", () => ({ useRouter: () => router }));

vi.mock("../SiteHeader", () => ({ SiteHeader: () => null }));
vi.mock("../SeoHead", () => ({ SeoHead: () => null }));
vi.mock("../JobDetailsDrawer", () => ({ JobDetailsDrawer: () => null }));
vi.mock("../WalletProvider", () => ({
  useWallet: () => ({ activeWallet: walletState.activeWallet, connectedWallet: null, source: "none", connecting: false, connect: walletState.connect }),
}));
vi.mock("../../lib/sse", async original => ({ ...await original<typeof import("../../lib/sse")>(), getJobSSE: () => ({ connect: vi.fn(), disconnect: vi.fn(), subscribe: () => vi.fn() }) }));

const onlineModels = {
  models: [{ name: "Studio SDXL", tier: "A", available: true, pipeline: "sdxl", task_type: "IMAGE_GEN" }],
};

describe("Create page model availability", () => {
  let container: HTMLDivElement;
  let root: Root;
  let catalog: () => Promise<unknown>;

  function button(label: string): HTMLButtonElement {
    const match = Array.from(container.querySelectorAll("button")).find(item => item.textContent?.trim() === label);
    expect(match, label).toBeDefined();
    return match!;
  }

  function changeInput(selector: string, value: string) {
    const input = container.querySelector<HTMLInputElement>(selector)!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  beforeEach(() => {
    router.query = {}; router.isReady = true;
    walletState.activeWallet = null;
    walletState.connect.mockReset().mockResolvedValue(undefined);
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    localStorage.clear();
    catalog = async () => onlineModels;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.endsWith("/models/list")) return { ok: true, json: catalog };
      return { ok: true, json: async () => ({ loras: [] }) };
    }));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("opens a linked video prompt without submitting or resetting the edited draft", async () => {
    router.query = { mode: "video", prompt: "A slow camera move over a quiet cove" };
    await act(async () => root.render(<CreatePage />));
    expect(button("Video").getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector<HTMLTextAreaElement>("#prompt")!.value).toBe(router.query.prompt);
    expect(vi.mocked(fetch).mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
    await act(async () => button("Image").click());
    router.query = { mode: "video", prompt: "A different URL prompt" };
    await act(async () => root.render(<CreatePage />));
    expect(button("Image").getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector<HTMLTextAreaElement>("#prompt")!.value).toBe("A slow camera move over a quiet cove");
  });

  it("ignores invalid mode and repeated prompt parameters", async () => {
    router.query = { mode: "unknown", prompt: ["one", "two"] };
    await act(async () => root.render(<CreatePage />));
    expect(button("Image").getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector<HTMLTextAreaElement>("#prompt")!.value).toBe("");
  });

  it("reports a failed account connection without losing the prompt", async () => {
    router.query = { prompt: "Keep my scene" };
    walletState.connect.mockRejectedValueOnce(new Error("Wallet connection was canceled."));
    await act(async () => root.render(<CreatePage />));
    await act(async () => container.querySelector<HTMLButtonElement>(".generator-wallet-summary button")!.click());
    expect(container.textContent).toContain("Wallet connection was canceled.");
    expect(container.querySelector<HTMLTextAreaElement>("#prompt")!.value).toBe("Keep my scene");
  });

  it("reviews a template before applying and submits its image settings only on Generate", async () => {
    walletState.activeWallet = "0x1111111111111111111111111111111111111111";
    router.query = { workflow: "17", prompt: "My existing draft" };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, json: async () => url.includes("/workflows/17") ? { name: "Soft portraits", category: "Image Generation", config: { model: "Studio SDXL", prompt_template: "A portrait of {subject}", negative_prompt: "blurry", steps: 37, guidance: 4.5 } } : url.endsWith("/models/list") ? onlineModels : { loras: [] } })));
    await act(async () => root.render(<CreatePage />));
    expect(container.querySelector<HTMLTextAreaElement>("#prompt")!.value).toBe("My existing draft");
    await act(async () => button("Apply template").click());
    expect(container.querySelector<HTMLTextAreaElement>("#prompt")!.value).toBe("A portrait of {subject}");
    expect(container.querySelector<HTMLTextAreaElement>("#template-negative")!.value).toBe("blurry");
    expect(container.querySelector<HTMLSelectElement>("#image-steps")!.value).toBe("template");
    expect(container.querySelector<HTMLInputElement>("#template-guidance")!.value).toBe("4.5");
    expect(vi.mocked(fetch).mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
    await act(async () => button("Generate image").click());
    const post = vi.mocked(fetch).mock.calls.find(([url, options]) => String(url).endsWith("/submit-job") && options?.method === "POST");
    expect(post).toBeDefined();
    expect(JSON.parse(String(post![1]!.body))).toMatchObject({ prompt: "A portrait of {subject}", model: "Studio SDXL", negative_prompt: "blurry", steps: 37, guidance: 4.5 });
  });

  it("does not replace the draft when a template requests an unavailable model", async () => {
    router.query = { workflow: "18", prompt: "Keep this idea" };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, json: async () => url.includes("/workflows/18") ? { name: "Unavailable setup", category: "Image Generation", config: { model: "Offline XL", prompt_template: "Different idea" } } : url.endsWith("/models/list") ? onlineModels : { loras: [] } })));
    await act(async () => root.render(<CreatePage />));
    await act(async () => button("Apply template").click());
    expect(container.textContent).toContain("not currently available");
    expect(container.querySelector<HTMLTextAreaElement>("#prompt")!.value).toBe("Keep this idea");
  });

  it("applies video settings after model and workflow defaults without submitting", async () => {
    router.query = { workflow: "19" };
    const models = { models: [...onlineModels.models, { name: "LTX Video", tier: "A", available: true, task_type: "LTX_VIDEO_GEN", model_family: "ltx23_wangp", pipeline: "ltx23_wangp", video_workflows: [{ id: "faithful", label: "Faithful animation", default: true, requires_init_image: true, settings: { steps: 12, guidance: 2 } }] }] };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, json: async () => url.includes("/workflows/19") ? { name: "Slow camera", category: "Video Generation", config: { model: "LTX Video", prompt_template: "Track across the scene", steps: 31, guidance: 5 } } : url.endsWith("/models/list") ? models : { loras: [] } })));
    await act(async () => root.render(<CreatePage />));
    await act(async () => button("Apply template").click());
    expect(button("Video").getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector<HTMLInputElement>("#steps")!.value).toBe("31");
    expect(container.querySelector<HTMLInputElement>("#guidance")!.value).toBe("5");
    expect(container.querySelector<HTMLInputElement>("#video-init-url")).not.toBeNull();
    expect(vi.mocked(fetch).mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
  });

  it("preserves an active render instead of applying a new linked prompt", async () => {
    localStorage.setItem(ACTIVE_CREATE_JOB_KEY, JSON.stringify({ id: "job-recovery", mode: "image", prompt: "My original scene", startedAt: Date.now() }));
    router.query = { mode: "video", prompt: "A new direction" };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, json: async () => url.includes("/jobs/job-recovery") ? { job_id: "job-recovery", status: "FAILED" } : url.endsWith("/models/list") ? onlineModels : { loras: [] } })));
    await act(async () => root.render(<CreatePage />));
    expect(button("Image").getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector<HTMLTextAreaElement>("#prompt")!.value).toBe("My original scene");
    expect(vi.mocked(fetch).mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
  });

  it("keeps the draft and references through a failed catalog load and retry", async () => {
    catalog = async () => { throw new Error("Offline"); };
    await act(async () => root.render(<CreatePage />));
    expect(container.textContent).toContain("Models couldn’t load");
    expect(button("Generate image").disabled).toBe(true);

    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Use prompt: Find a different perspective"]')!.click());
    const prompt = container.querySelector<HTMLTextAreaElement>("#prompt")!.value;
    expect(prompt).toContain("Mediterranean");
    await act(async () => button("Model, size & reference").click());
    await act(async () => changeInput("#image-reference-url", "https://example.com/reference.png"));
    await act(async () => changeInput("#image-seed", "42"));

    catalog = async () => onlineModels;
    await act(async () => button("Retry").click());
    expect(container.querySelector<HTMLTextAreaElement>("#prompt")!.value).toBe(prompt);
    expect(container.querySelector<HTMLInputElement>("#image-reference-url")!.value).toBe("https://example.com/reference.png");
    expect(container.querySelector<HTMLInputElement>("#image-seed")!.value).toBe("42");
    expect(button("Generate image").disabled).toBe(false);
    expect(container.textContent).toContain("Using Studio SDXL");
  });

  it("distinguishes no online capacity from a broken response and blocks generation", async () => {
    catalog = async () => ({ models: [] });
    await act(async () => root.render(<CreatePage />));
    expect(container.textContent).toContain("No image models online");
    expect(button("Generate image").disabled).toBe(true);
    await act(async () => button("Video").click());
    expect(container.textContent).toContain("No video models online");
    catalog = async () => ({ unexpected: true });
    await act(async () => button("Retry").click());
    expect(container.textContent).toContain("Models couldn’t load");
    expect(button("Generate video").disabled).toBe(true);
  });

  it("shows a required video start frame while advanced settings are closed, without duplicating inputs", async () => {
    catalog = async () => ({ models: [{
      name: "LTX Video", tier: "A", available: true, task_type: "LTX_VIDEO_GEN",
      model_family: "ltx23_wangp", pipeline: "ltx23_wangp",
      video_workflows: [{ id: "faithful_i2v", label: "Faithful animation", default: true, requires_init_image: true }],
    }] });
    await act(async () => root.render(<CreatePage />));
    await act(async () => button("Video").click());
    expect(button("Video settings & reference").getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector('[aria-label="Required video start frame"]')).not.toBeNull();
    expect(container.querySelectorAll("#video-init-url")).toHaveLength(1);
    await act(async () => changeInput("#video-init-url", "https://example.com/start.png"));
    await act(async () => button("Video settings & reference").click());
    expect(container.querySelectorAll("#video-init-url")).toHaveLength(1);
    expect(container.querySelector<HTMLInputElement>("#video-init-url")!.value).toBe("https://example.com/start.png");
  });

  it("ends a stalled model request and offers retry", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((url: string, options?: RequestInit) => {
      if (url.endsWith("/models/list")) {
        return new Promise((_, reject) => options?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))));
      }
      return Promise.resolve({ ok: true, json: async () => ({ loras: [] }) });
    }));
    try {
      await act(async () => root.render(<CreatePage />));
      expect(container.textContent).toContain("Finding available models");
      await act(async () => vi.advanceTimersByTimeAsync(12000));
      expect(container.textContent).toContain("Models couldn’t load");
      expect(button("Retry").disabled).toBe(false);
      expect(button("Generate image").disabled).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
