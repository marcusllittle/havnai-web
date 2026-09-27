import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchGalleryBrowse } from "../havnai";

afterEach(() => vi.unstubAllGlobals());

describe("legacy gallery browse fallback", () => {
  it("hides wallet-era rows that are not account-backed", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      listings: [
        {
          id: 15,
          job_id: "job-legacy",
          seller_wallet: "0x2222222222222222222222222222222222222222",
          owner_wallet: "0x2222222222222222222222222222222222222222",
          title: "Legacy rough output",
          price_credits: 5,
          asset_type: "image",
          listed: true,
          sold: false,
          status: "active",
          image_url: "/static/outputs/job-legacy.png",
          created_at: 1,
          updated_at: 1,
        },
        {
          id: 16,
          job_id: "job-account",
          owner_account_id: "acct_123",
          seller_account_id: "acct_123",
          title: "Account-backed listing",
          price_credits: 7,
          asset_type: "image",
          listed: true,
          sold: false,
          status: "active",
          preview_url: "/v2/marketplace/listings/16/preview",
          created_at: 2,
          updated_at: 2,
        },
      ],
      total: 2,
      limit: 24,
      offset: 0,
      sort: "newest",
    })));
    vi.stubGlobal("fetch", fetcher);

    const result = await fetchGalleryBrowse({ limit: 24 });

    expect(fetcher.mock.calls[0][0]).toBe("/api/gallery/browse?limit=24");
    expect(result.total).toBe(1);
    expect(result.listings).toHaveLength(1);
    expect(result.listings[0]).toMatchObject({
      id: 16,
      job_id: "job-account",
      owner_account_id: "acct_123",
      seller_account_id: "acct_123",
      title: "Account-backed listing",
    });
  });
});
