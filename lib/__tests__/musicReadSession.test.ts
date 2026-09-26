import { afterEach, expect, it, vi } from "vitest";
import { clearMusicReadSession, getMusicReadSession } from "../musicReadSession";

const wallet = "0x1111111111111111111111111111111111111111";
const value = () => ({ wallet, token: "test-token", expires_at: Date.now() / 1000 + 28800 });
afterEach(() => { clearMusicReadSession(); vi.useRealTimers(); });

it("shares concurrent authorization across private reads and later visits", async () => {
  const create = vi.fn().mockImplementation(async () => value());
  const results = await Promise.all(Array.from({ length: 5 }, () => getMusicReadSession(wallet, create)));
  expect(results.every(result => result.token === "test-token")).toBe(true);
  await getMusicReadSession(wallet, create);
  expect(create).toHaveBeenCalledTimes(1);
});

it("expires sessions and requires new authorization after disconnect", async () => {
  vi.useFakeTimers();
  const create = vi.fn().mockImplementation(async () => value());
  await getMusicReadSession(wallet, create);
  vi.advanceTimersByTime(8 * 3600_000);
  await getMusicReadSession(wallet, create);
  clearMusicReadSession();
  await getMusicReadSession(wallet, create);
  expect(create).toHaveBeenCalledTimes(3);
});

it("discards authorization completed after a wallet change", async () => {
  let finish!: (result: ReturnType<typeof value>) => void;
  const request = getMusicReadSession(wallet, () => new Promise(resolve => { finish = resolve; }));
  await Promise.resolve();
  clearMusicReadSession(); finish(value());
  await expect(request).rejects.toThrow("Wallet changed");
  const create = vi.fn().mockResolvedValue(value());
  await getMusicReadSession(wallet, create);
  expect(create).toHaveBeenCalledTimes(1);
});

it("shares rejection without queuing five signatures and permits an explicit retry", async () => {
  const create = vi.fn().mockRejectedValue(new Error("User rejected"));
  const results = await Promise.allSettled(Array.from({ length: 5 }, () => getMusicReadSession(wallet, create)));
  expect(results.every(result => result.status === "rejected")).toBe(true);
  expect(create).toHaveBeenCalledTimes(1);
  create.mockResolvedValue(value());
  await getMusicReadSession(wallet, create);
  expect(create).toHaveBeenCalledTimes(2);
});
