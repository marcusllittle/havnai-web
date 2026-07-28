import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OutputCard } from "../OutputCard";

describe("OutputCard", () => {
  it("keeps a visible output frame while a job is rendering", () => {
    const html = renderToStaticMarkup(
      <OutputCard
        jobId="job-rendering"
        pending
        statusMessage="Rendering on a HavnAI node..."
      />
    );

    expect(html).toContain("generator-output-placeholder");
    expect(html).toContain("Rendering on a HavnAI node...");
    expect(html).toContain("#job-renderin");
  });

  it("renders the completed image returned by the coordinator", () => {
    const html = renderToStaticMarkup(
      <OutputCard imageUrl="/api/static/outputs/job-complete.png" jobId="job-complete" />
    );

    expect(html).toContain('src="/api/static/outputs/job-complete.png"');
    expect(html).toContain('alt="job-complete"');
  });
});
