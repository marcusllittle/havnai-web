import type { NextPage } from "next";
import Head from "next/head";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchMarketplace,
  createWorkflow,
  publishWorkflow,
  Workflow,
  WALLET,
} from "../lib/havnai";

type ViewMode = "browse" | "create";

const CATEGORIES = ["All", "Image Generation", "Video Generation", "Face Swap", "Upscaling", "Style Transfer", "Other"];

const MarketplacePage: NextPage = () => {
  const [navOpen, setNavOpen] = useState(false);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("browse");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [page, setPage] = useState(0);
  const limit = 20;

  // Create form
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formCategory, setFormCategory] = useState("Image Generation");
  const [formModel, setFormModel] = useState("");
  const [formPrompt, setFormPrompt] = useState("");
  const [formNeg, setFormNeg] = useState("");
  const [formSteps, setFormSteps] = useState(28);
  const [formGuidance, setFormGuidance] = useState(6);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");

  // Selected workflow for detail view
  const [selected, setSelected] = useState<Workflow | null>(null);

  const loadWorkflows = useCallback(async () => {
    setLoading(true);
    try {
      const cat = category === "All" ? undefined : category;
      const res = await fetchMarketplace({ search: search || undefined, category: cat, offset: page * limit, limit });
      setWorkflows(res.workflows);
      setTotal(res.total);
    } catch {
      setWorkflows([]);
    }
    setLoading(false);
  }, [search, category, page]);

  useEffect(() => { loadWorkflows(); }, [loadWorkflows]);

  const totalPages = Math.ceil(total / limit);

  const handleCreate = async () => {
    if (!formName.trim()) { setCreateError("Name is required."); return; }
    setCreating(true);
    setCreateError("");
    setCreateSuccess("");
    try {
      const workflow = await createWorkflow({
        name: formName.trim(),
        description: formDesc.trim(),
        category: formCategory,
        config: {
          model: formModel.trim() || "auto",
          prompt_template: formPrompt.trim(),
          negative_prompt: formNeg.trim(),
          steps: formSteps,
          guidance: formGuidance,
        },
      });
      setCreateSuccess(`Workflow "${workflow.name}" created! You can publish it to make it visible.`);
      setFormName("");
      setFormDesc("");
      setFormPrompt("");
      setFormNeg("");
    } catch (err: any) {
      setCreateError(err?.message || "Failed to create workflow.");
    }
    setCreating(false);
  };

  return (
    <>
      <Head><title>HavnAI Templates</title></Head>
      <header className="site-header">
        <div className="header-inner">
          <a href="/#home" className="brand">
            <img src="/HavnAI-logo.png" alt="HavnAI" className="brand-logo" />
            <div className="brand-text">
              <span className="brand-stage">Stage 6 + 7 Alpha</span>
              <span className="brand-name">HavnAI Network</span>
            </div>
          </a>
          <button type="button" className={`nav-toggle ${navOpen ? "nav-open" : ""}`} aria-label="Toggle navigation" onClick={() => setNavOpen((o) => !o)}>
            <span /><span />
          </button>
          <nav className={`nav-links ${navOpen ? "nav-open" : ""}`} onClick={() => setNavOpen(false)}>
            <a href="/#home">Home</a>
            <a href="/test">Generator</a>
            <a href="/library">My Library</a>
            <a href="/pricing">Buy Credits</a>
            <a href="/analytics">Analytics</a>
            <a href="/nodes">Nodes</a>
            <a href="/marketplace">Marketplace</a>
            <a href="/templates" className="nav-active">Templates</a>
            <a href="/join" className="nav-primary">Join</a>
          </nav>
        </div>
      </header>

      <main className="library-page">
        <section className="page-hero">
          <div className="page-hero-inner">
            <p className="hero-kicker">Templates</p>
            <h1 className="hero-title">Workflow Templates</h1>
            <p className="hero-subtitle">Browse and publish reusable generation presets.</p>
          </div>
        </section>

        <section className="page-container">
          {/* View switcher */}
          <div className="library-toolbar-inner" style={{ marginBottom: "1.5rem" }}>
            <div className="library-filters">
              <div className="library-filter-group">
                <span className="library-filter-label">View</span>
                <button type="button" className={`library-chip ${view === "browse" ? "is-active" : ""}`} onClick={() => setView("browse")}>Browse</button>
                <button type="button" className={`library-chip ${view === "create" ? "is-active" : ""}`} onClick={() => setView("create")}>Create Workflow</button>
              </div>
            </div>
          </div>

          {/* Browse view */}
          {view === "browse" && (
            <>
              <div className="library-toolbar-inner" style={{ marginBottom: "1.5rem" }}>
                <div className="library-search-wrapper">
                  <input
                    type="text"
                    className="library-search"
                    placeholder="Search workflows..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                  />
                </div>
                <div className="library-filters">
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
                </div>
              </div>

              {loading && <p className="library-loading">Loading workflows...</p>}

              {!loading && workflows.length === 0 && (
                <div className="library-empty">
                  <p>No workflows found. Be the first to publish one!</p>
                </div>
              )}

              {!loading && workflows.length > 0 && (
                <>
                  <div className="marketplace-grid">
                    {workflows.map((wf) => (
                      <div key={wf.id} className="workflow-card" onClick={() => setSelected(wf)}>
                        <div className="workflow-name">{wf.name}</div>
                        <div className="workflow-desc">{wf.description || "No description"}</div>
                        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                          {wf.category && <span className="workflow-tag">{wf.category}</span>}
                          {wf.config?.model && <span className="workflow-tag">{wf.config.model}</span>}
                        </div>
                        <div className="workflow-meta">
                          <span>{wf.usage_count} uses</span>
                          <span>{new Date(wf.created_at).toLocaleDateString()}</span>
                          <span style={{ fontFamily: "monospace", fontSize: "0.7rem" }}>
                            {wf.creator_wallet.slice(0, 6)}...{wf.creator_wallet.slice(-4)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
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
            </>
          )}

          {/* Create workflow view */}
          {view === "create" && (
            <div className="chart-section">
              <div className="chart-header">
                <h3 className="chart-title">Create a Workflow</h3>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
                <label>
                  <span className="library-filter-label" style={{ display: "block", marginBottom: "0.3rem" }}>Name</span>
                  <input type="text" className="library-search" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="My Awesome Workflow" />
                </label>
                <label>
                  <span className="library-filter-label" style={{ display: "block", marginBottom: "0.3rem" }}>Description</span>
                  <textarea className="library-search" style={{ minHeight: "60px", resize: "vertical" }} value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="What does this workflow do?" />
                </label>
                <label>
                  <span className="library-filter-label" style={{ display: "block", marginBottom: "0.3rem" }}>Category</span>
                  <select className="library-sort-select" value={formCategory} onChange={(e) => setFormCategory(e.target.value)}>
                    {CATEGORIES.filter((c) => c !== "All").map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="library-filter-label" style={{ display: "block", marginBottom: "0.3rem" }}>Model (leave empty for auto)</span>
                  <input type="text" className="library-search" value={formModel} onChange={(e) => setFormModel(e.target.value)} placeholder="juggernautXL_ragnarokBy" />
                </label>
                <label>
                  <span className="library-filter-label" style={{ display: "block", marginBottom: "0.3rem" }}>Prompt Template</span>
                  <textarea className="library-search" style={{ minHeight: "80px", resize: "vertical" }} value={formPrompt} onChange={(e) => setFormPrompt(e.target.value)} placeholder="A beautiful portrait of {subject}, cinematic lighting..." />
                </label>
                <label>
                  <span className="library-filter-label" style={{ display: "block", marginBottom: "0.3rem" }}>Negative Prompt</span>
                  <textarea className="library-search" style={{ minHeight: "50px", resize: "vertical" }} value={formNeg} onChange={(e) => setFormNeg(e.target.value)} placeholder="blurry, bad quality..." />
                </label>
                <div style={{ display: "flex", gap: "1rem" }}>
                  <label style={{ flex: 1 }}>
                    <span className="library-filter-label" style={{ display: "block", marginBottom: "0.3rem" }}>Steps</span>
                    <input type="number" className="library-search" value={formSteps} onChange={(e) => setFormSteps(Number(e.target.value))} min={1} max={100} />
                  </label>
                  <label style={{ flex: 1 }}>
                    <span className="library-filter-label" style={{ display: "block", marginBottom: "0.3rem" }}>Guidance</span>
                    <input type="number" className="library-search" value={formGuidance} onChange={(e) => setFormGuidance(Number(e.target.value))} min={1} max={30} step={0.5} />
                  </label>
                </div>
                {createError && <p className="job-hint error">{createError}</p>}
                {createSuccess && <p className="job-hint" style={{ color: "#8ff0b6" }}>{createSuccess}</p>}
                <button type="button" className="job-action-button" disabled={creating} onClick={handleCreate} style={{ alignSelf: "flex-start", marginTop: "0.5rem" }}>
                  {creating ? "Creating..." : "Create Workflow"}
                </button>
              </div>
            </div>
          )}

          {/* Workflow detail modal */}
          {selected && (
            <div className="job-drawer" onClick={() => setSelected(null)}>
              <div className="job-drawer-backdrop" />
              <aside className="job-drawer-panel" role="dialog" onClick={(e) => e.stopPropagation()}>
                <div className="job-drawer-header">
                  <div>
                    <p className="job-drawer-kicker">Workflow</p>
                    <h3>{selected.name}</h3>
                    <div className="job-meta-row">
                      {selected.category && <span className="workflow-tag">{selected.category}</span>}
                      <span>{selected.usage_count} uses</span>
                    </div>
                  </div>
                  <button type="button" className="job-drawer-close" onClick={() => setSelected(null)}>Close</button>
                </div>
                <div className="job-drawer-body">
                  <section className="job-section">
                    <h4>Description</h4>
                    <p style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>{selected.description || "No description provided."}</p>
                  </section>
                  <section className="job-section">
                    <h4>Configuration</h4>
                    <div className="job-details-grid">
                      {selected.config?.model && (
                        <div><span className="job-label">Model</span><span>{selected.config.model}</span></div>
                      )}
                      {selected.config?.steps && (
                        <div><span className="job-label">Steps</span><span>{selected.config.steps}</span></div>
                      )}
                      {selected.config?.guidance && (
                        <div><span className="job-label">Guidance</span><span>{selected.config.guidance}</span></div>
                      )}
                    </div>
                  </section>
                  {selected.config?.prompt_template && (
                    <section className="job-section">
                      <h4>Prompt Template</h4>
                      <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", lineHeight: 1.5 }}>{selected.config.prompt_template}</p>
                    </section>
                  )}
                  <section className="job-section">
                    <h4>Creator</h4>
                    <p className="wallet-address">{selected.creator_wallet}</p>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: "0.3rem" }}>
                      Created {new Date(selected.created_at).toLocaleDateString()}
                    </p>
                  </section>
                  <section className="job-section">
                    <div className="job-actions">
                      <a href={`/test?workflow=${selected.id}`} className="job-action-button" style={{ textDecoration: "none", textAlign: "center" }}>
                        Use This Workflow
                      </a>
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
