import type { NextPage } from "next";
import Head from "next/head";
import { useCallback, useEffect, useState } from "react";
import {
  fetchGallery,
  purchaseGalleryListingWithMetaMask,
  fetchResult,
  resolveAssetUrl,
  GalleryListing,
  ResultResponse,
  WALLET,
} from "../lib/havnai";
import { getApiBase } from "../lib/apiBase";

type SortOption = "newest" | "price_low" | "price_high";
type TypeFilter = "all" | "image" | "video";

const CATEGORIES = ["All", "Portrait", "Landscape", "Abstract", "Cinematic", "Anime", "Other"];

const MarketplacePage: NextPage = () => {
  const [navOpen, setNavOpen] = useState(false);
  const [listings, setListings] = useState<GalleryListing[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sort, setSort] = useState<SortOption>("newest");
  const [page, setPage] = useState(0);
  const limit = 24;

  // Preview/detail state
  const [selected, setSelected] = useState<GalleryListing | null>(null);
  const [selectedResult, setSelectedResult] = useState<ResultResponse | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseMsg, setPurchaseMsg] = useState("");
  const [purchaseErr, setPurchaseErr] = useState("");

  // Results cache for previews
  const [resultCache, setResultCache] = useState<Record<string, ResultResponse>>({});

  const apiBase = getApiBase();

  const loadListings = useCallback(async () => {
    setLoading(true);
    try {
      const cat = category === "All" ? undefined : category;
      const assetType = typeFilter === "all" ? undefined : typeFilter;
      const res = await fetchGallery({
        search: search || undefined,
        category: cat,
        asset_type: assetType,
        sort,
        offset: page * limit,
        limit,
      });
      setListings(res.listings);
      setTotal(res.total);

      // Fetch results for previews
      const newCache: Record<string, ResultResponse> = { ...resultCache };
      const toFetch = res.listings.filter((l) => !newCache[l.job_id]);
      await Promise.all(
        toFetch.slice(0, 12).map(async (l) => {
          try {
            const r = await fetchResult(l.job_id);
            newCache[l.job_id] = r;
          } catch {
            // Result not available
          }
        })
      );
      setResultCache(newCache);
    } catch {
      setListings([]);
    }
    setLoading(false);
  }, [search, category, typeFilter, sort, page]);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  // Fetch remaining previews after initial load
  useEffect(() => {
    if (listings.length === 0) return;
    const missing = listings.filter((l) => !resultCache[l.job_id]);
    if (missing.length === 0) return;
    const fetchRemaining = async () => {
      const newCache: Record<string, ResultResponse> = { ...resultCache };
      await Promise.all(
        missing.map(async (l) => {
          try {
            const r = await fetchResult(l.job_id);
            newCache[l.job_id] = r;
          } catch {
            // skip
          }
        })
      );
      setResultCache(newCache);
    };
    fetchRemaining();
  }, [listings]);

  const openDetail = async (listing: GalleryListing) => {
    setSelected(listing);
    setPurchaseMsg("");
    setPurchaseErr("");
    if (resultCache[listing.job_id]) {
      setSelectedResult(resultCache[listing.job_id]);
    } else {
      try {
        const r = await fetchResult(listing.job_id);
        setSelectedResult(r);
        setResultCache((prev) => ({ ...prev, [listing.job_id]: r }));
      } catch {
        setSelectedResult(null);
      }
    }
  };

  const handlePurchase = async () => {
    if (!selected) return;
    setPurchasing(true);
    setPurchaseErr("");
    setPurchaseMsg("");
    try {
      const res = await purchaseGalleryListingWithMetaMask(selected.id, selected.price_credits);
      setPurchaseMsg(`Purchased! ${res.remaining_credits.toFixed(1)} credits remaining.`);
      // Remove from browse view
      setListings((prev) => prev.filter((l) => l.id !== selected.id));
      setTotal((prev) => prev - 1);
    } catch (err: any) {
      setPurchaseErr(err?.message || "Purchase failed.");
    }
    setPurchasing(false);
  };

  const totalPages = Math.ceil(total / limit);

  const getPreviewUrl = (listing: GalleryListing): string | undefined => {
    const r = resultCache[listing.job_id];
    if (!r) return undefined;
    return resolveAssetUrl(r.video_url || r.image_url);
  };

  return (
    <>
      <Head><title>HavnAI Marketplace</title></Head>
      <header className="site-header">
        <div className="header-inner">
          <a href="/#home" className="brand">
            <img src="/HavnAI-logo.png" alt="HavnAI" className="brand-logo" />
            <div className="brand-text">
              <span className="brand-stage">Public Beta</span>
              <span className="brand-name">HavnAI Network</span>
            </div>
          </a>
          <button type="button" className={`nav-toggle ${navOpen ? "nav-open" : ""}`} aria-label="Toggle navigation" onClick={() => setNavOpen((o) => !o)}>
            <span /><span />
          </button>
          <nav className={`nav-links ${navOpen ? "nav-open" : ""}`} onClick={() => setNavOpen(false)}>
            <a href="/#home">Home</a>
            <a href="/generator">Generator</a>
            <a href="/library">My Library</a>
            <a href={`${apiBase}/dashboard`} target="_blank" rel="noreferrer">Dashboard</a>
            <a href="/pricing">Buy Credits</a>
            <a href="/analytics">Analytics</a>
            <a href="/nodes">Nodes</a>
            <a href="/marketplace" className="nav-active">Marketplace</a>
            <a href="/join" className="nav-primary">Join</a>
          </nav>
        </div>
      </header>

      <main className="library-page">
        <section className="page-hero">
          <div className="page-hero-inner">
            <p className="hero-kicker">Marketplace</p>
            <h1 className="hero-title">Gallery</h1>
            <p className="hero-subtitle">
              Browse and purchase AI-generated images and videos created by the community.
              Use credits to buy creations you like.
            </p>
          </div>
        </section>

        <section className="page-container">
          {/* Toolbar */}
          <div className="library-toolbar-inner" style={{ marginBottom: "1.5rem" }}>
            <div className="library-search-wrapper">
              <input
                type="text"
                className="library-search"
                placeholder="Search by title, model, or prompt..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              />
            </div>
            <div className="library-filters">
              <div className="library-filter-group">
                <span className="library-filter-label">Type</span>
                {(["all", "image", "video"] as TypeFilter[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`library-chip ${typeFilter === t ? "is-active" : ""}`}
                    onClick={() => { setTypeFilter(t); setPage(0); }}
                  >
                    {t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
              <div className="library-filter-group" style={{ flexWrap: "wrap" }}>
                <span className="library-filter-label">Category</span>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`library-chip ${category === cat ? "is-active" : ""}`}
                    onClick={() => { setCategory(cat); setPage(0); }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="library-filter-group">
                <span className="library-filter-label">Sort</span>
                <select
                  className="library-sort-select"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortOption)}
                >
                  <option value="newest">Newest</option>
                  <option value="price_low">Price: Low to High</option>
                  <option value="price_high">Price: High to Low</option>
                </select>
              </div>
            </div>
          </div>

          {loading && <p className="library-loading">Loading marketplace...</p>}

          {!loading && listings.length === 0 && (
            <div className="library-empty">
              <p>No listings yet. Be the first to list something from your library!</p>
              <a href="/library" className="job-action-button" style={{ textDecoration: "none", display: "inline-block", marginTop: "0.5rem" }}>
                Go to Library
              </a>
            </div>
          )}

          {!loading && listings.length > 0 && (
            <>
              <div className="marketplace-grid">
                {listings.map((listing) => {
                  const previewUrl = getPreviewUrl(listing);
                  return (
                    <div
                      key={listing.id}
                      className="gallery-card"
                      onClick={() => openDetail(listing)}
                    >
                      <div className="gallery-preview">
                        {previewUrl ? (
                          listing.asset_type === "video" ? (
                            <video src={previewUrl} muted playsInline loop className="gallery-media" />
                          ) : (
                            <img src={previewUrl} alt={listing.title} loading="lazy" className="gallery-media" />
                          )
                        ) : (
                          <div className="gallery-preview-empty">
                            {listing.asset_type === "video" ? "Video" : "Image"}
                          </div>
                        )}
                        <span className={`library-badge library-type-${listing.asset_type}`}>
                          {listing.asset_type}
                        </span>
                      </div>
                      <div className="gallery-body">
                        <div className="gallery-title">{listing.title}</div>
                        <div className="gallery-meta">
                          <span className="gallery-price">{listing.price_credits} credits</span>
                          <span className="gallery-model">{listing.model || "auto"}</span>
                        </div>
                        <div className="gallery-seller">
                          {listing.seller_wallet.slice(0, 6)}...{listing.seller_wallet.slice(-4)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", marginTop: "1.5rem" }}>
                  <button type="button" className="library-chip" disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</button>
                  <span style={{ padding: "4px 10px", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                    {page + 1} / {totalPages}
                  </span>
                  <button type="button" className="library-chip" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next</button>
                </div>
              )}
            </>
          )}

          {/* Detail / Purchase drawer */}
          {selected && (
            <div className="job-drawer" onClick={() => setSelected(null)}>
              <div className="job-drawer-backdrop" />
              <aside className="job-drawer-panel" role="dialog" onClick={(e) => e.stopPropagation()}>
                <div className="job-drawer-header">
                  <div>
                    <p className="job-drawer-kicker">Marketplace</p>
                    <h3>{selected.title}</h3>
                    <div className="job-meta-row">
                      <span className={`library-badge library-type-${selected.asset_type}`}>
                        {selected.asset_type}
                      </span>
                      <span className="gallery-price" style={{ fontSize: "1.1rem" }}>
                        {selected.price_credits} credits
                      </span>
                    </div>
                  </div>
                  <button type="button" className="job-drawer-close" onClick={() => setSelected(null)}>Close</button>
                </div>
                <div className="job-drawer-body">
                  {/* Preview */}
                  {selectedResult && (
                    <section className="job-section">
                      <div style={{ borderRadius: "12px", overflow: "hidden", background: "var(--bg-elevated)" }}>
                        {selectedResult.video_url ? (
                          <video
                            src={resolveAssetUrl(selectedResult.video_url)}
                            controls
                            playsInline
                            style={{ width: "100%", display: "block" }}
                          />
                        ) : selectedResult.image_url ? (
                          <img
                            src={resolveAssetUrl(selectedResult.image_url)}
                            alt={selected.title}
                            style={{ width: "100%", display: "block" }}
                          />
                        ) : null}
                      </div>
                    </section>
                  )}

                  {/* Info */}
                  <section className="job-section">
                    <h4>Details</h4>
                    <div className="job-details-grid">
                      {selected.model && (
                        <div><span className="job-label">Model</span><span>{selected.model}</span></div>
                      )}
                      {selected.category && (
                        <div><span className="job-label">Category</span><span>{selected.category}</span></div>
                      )}
                      <div>
                        <span className="job-label">Seller</span>
                        <span style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{selected.seller_wallet}</span>
                      </div>
                      <div>
                        <span className="job-label">Listed</span>
                        <span>{new Date(selected.created_at * 1000).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </section>

                  {selected.description && (
                    <section className="job-section">
                      <h4>Description</h4>
                      <p style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>{selected.description}</p>
                    </section>
                  )}

                  {selected.prompt && (
                    <section className="job-section">
                      <h4>Prompt</h4>
                      <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", lineHeight: 1.5 }}>{selected.prompt}</p>
                    </section>
                  )}

                  {/* Purchase action */}
                  <section className="job-section">
                    <div className="job-actions">
                      {purchaseMsg ? (
                        <p style={{ color: "#8ff0b6", textAlign: "center" }}>{purchaseMsg}</p>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="job-action-button"
                            disabled={purchasing || selected.seller_wallet.toLowerCase() === WALLET.toLowerCase()}
                            onClick={handlePurchase}
                            style={{ width: "100%" }}
                          >
                            {purchasing
                              ? "Processing..."
                              : selected.seller_wallet.toLowerCase() === WALLET.toLowerCase()
                              ? "Your Listing"
                              : `Buy for ${selected.price_credits} Credits`}
                          </button>
                          {purchaseErr && (
                            <p className="job-hint error" style={{ marginTop: "0.5rem" }}>{purchaseErr}</p>
                          )}
                        </>
                      )}
                    </div>
                  </section>
                </div>
              </aside>
            </div>
          )}
        </section>
      </main>
    </>
  );
};

export default MarketplacePage;
