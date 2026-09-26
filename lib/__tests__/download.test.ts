import { afterEach, expect, it, vi } from "vitest";
import { downloadAsset } from "../download";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it.each([
  ["/api/account-media/art-image", "image/png", undefined, "art-image.png"],
  ["/api/account-media/art-video", "video/mp4", undefined, "art-video.mp4"],
  ["/output/photo.jpg?version=2", "image/jpeg", undefined, "photo.jpg"],
  ["/api/account-media/art-image", "image/png", "chosen.png", "chosen.png"],
])("saves %s with a usable filename", async (url, type, filename, expected) => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(["media"], { type }) }));
  const create = vi.fn().mockReturnValue("blob:test");
  const revoke = vi.fn();
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL = create;
    static revokeObjectURL = revoke;
  });
  let saved = "";
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () { saved = this.download; });
  await downloadAsset(url, filename);
  expect(saved).toBe(expected);
  expect(document.querySelector('a[href="blob:test"]')).toBeNull();
  vi.runAllTimers();
  expect(revoke).toHaveBeenCalledWith("blob:test");
});
