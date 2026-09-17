import { useEffect, useState } from "react";
import { fetchWorkflow } from "../lib/havnai";
import { readWorkflowTemplate, type WorkflowTemplate } from "../lib/workflowTemplate";

export function WorkflowImport({ id, disabled, onApply }: { id: string; disabled: boolean; onApply: (template: WorkflowTemplate) => string | undefined }) {
  const [template, setTemplate] = useState<WorkflowTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [applyError, setApplyError] = useState("");
  const [applied, setApplied] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true); setError(""); setTemplate(null); setApplied(false); setApplyError(""); setDismissed(false);
    const timeout = setTimeout(() => controller.abort(), 12000);
    fetchWorkflow(id, { signal: controller.signal }).then(readWorkflowTemplate)
      .then(value => { if (active) setTemplate(value); })
      .catch(reason => { if (active) setError(reason instanceof Error && !controller.signal.aborted ? reason.message : "The template couldn’t load. Try again."); })
      .finally(() => { clearTimeout(timeout); if (active) setLoading(false); });
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [id, revision]);
  if (dismissed) return null;
  return <aside className="studio-template" aria-label="Selected workflow template">
    <div className="studio-template-heading"><span>Workflow template</span><button type="button" onClick={() => setDismissed(true)}>Dismiss</button></div>
    {loading ? <p role="status">Loading your template…</p> : error ? <><p role="alert">{error}</p><button type="button" onClick={() => setRevision(value => value + 1)}>Retry template</button></> : template && <>
      <h2>{template.name}</h2>
      <p>{template.mode === "face_swap" ? "Face swap" : template.mode === "video" ? "Video" : "Image"} · {template.model === "auto" ? "Available model" : template.model}{template.steps != null ? ` · ${template.steps} steps` : ""}{template.guidance != null ? ` · Guidance ${template.guidance}` : ""}</p>
      {template.additionalSettings.length > 0 && <p>Additional settings won’t be imported: {template.additionalSettings.join(", ")}.</p>}
      <p>{applied ? "Template applied. Edit the prompt and any placeholders before generating." : "Apply to replace your current prompt and generation settings. Review your source images after switching modes."}</p>
      {applyError && <p role="alert">{applyError}</p>}
      <button type="button" disabled={disabled || applied} onClick={() => { const message = onApply(template); setApplyError(message || ""); if (!message) setApplied(true); }}>{applied ? "Applied" : "Apply template"}</button>
    </>}
  </aside>;
}
