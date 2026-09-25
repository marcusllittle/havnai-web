import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const account = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("../AccountProvider", () => ({ useAccount: () => account }));
import { AccountPurchases } from "../AccountPurchases";

const list = { purchases: [{ id: "pur_alice", package_id: "starter", units: 50_000, price_cents: 500, currency: "usd", state: "paid", created_at: 1 }], scale: 1000, next_cursor: null };

describe("Account purchase receipts", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    account.request.mockReset().mockResolvedValue(list);
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
  const render = async (key = "alice") => act(async () => { root.render(<AccountPurchases key={key} />); });

  it("loads durable receipts on explicit selection", async () => {
    await render();
    expect(container.textContent).toContain("50 credits");
    expect(account.request.mock.calls[0][0]).toBe("/v2/account/purchases");
    account.request.mockResolvedValueOnce({ purchase_id: "pur_alice", state: "partially_refunded", scale: 1000,
      receipt: { id: 1, price_cents: 500, currency: "usd", units: 50_000, terms_version: "credits-v1", created_at: 1 },
      adjustments: [{ refunded_cents: 100, disputed_cents: 0, retained_units: 40_000, settled_delta: -10_000, created_at: 2 }] });
    const button = [...container.querySelectorAll("button")].find(item => item.textContent === "View receipt")!;
    await act(async () => button.click());
    expect(account.request.mock.calls[1][0]).toBe("/v2/account/purchases/pur_alice");
    expect(container.textContent).toContain("Partially refunded");
    expect(container.textContent).toContain("-10 credits adjusted");
    expect(container.textContent).toContain("Receipt #1");
  });

  it("does not infer a paid receipt from checkout return parameters", async () => {
    history.replaceState(null, "", "/account?purchase=pur_alice&paid=true");
    account.request.mockResolvedValueOnce({ ...list, purchases: [{ ...list.purchases[0], state: "pending" }] });
    await render();
    expect(container.textContent).toContain("Awaiting payment confirmation");
    expect(container.textContent).not.toContain("Receipt #");
    expect(account.request).toHaveBeenCalledTimes(1);
    history.replaceState(null, "", "/");
  });

  it("aborts old requests and clears purchases when the account key changes", async () => {
    let resolveAlice!: (value: typeof list) => void;
    account.request.mockImplementationOnce(() => new Promise(resolve => { resolveAlice = resolve; }));
    await render();
    const signal = account.request.mock.calls[0][1].signal as AbortSignal;
    account.request.mockResolvedValueOnce({ purchases: [], scale: 1000, next_cursor: null });
    await render("bob");
    await act(async () => { resolveAlice(list); });
    expect(signal.aborted).toBe(true);
    expect(container.textContent).toContain("No purchases yet");
    expect(container.textContent).not.toContain("50 credits");
  });

  it("reports errors and offers a retry without a wallet request", async () => {
    account.request.mockRejectedValueOnce(new Error("Payment history unavailable"));
    await render();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Payment history unavailable");
    await act(async () => container.querySelector("button")!.click());
    expect(container.textContent).toContain("50 credits");
    expect(account.request.mock.calls.every(call => call[0] === "/v2/account/purchases")).toBe(true);
  });
});
