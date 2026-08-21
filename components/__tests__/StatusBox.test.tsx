import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StatusBox } from "../StatusBox";

describe("StatusBox", () => {
  it("renders verified render progress as an accessible bar", () => {
    const html = renderToStaticMarkup(
      <StatusBox message="Generating image · 50%" />
    );

    expect(html).toContain("status-loading");
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="50"');
    expect(html).toContain('style="width:50%"');
  });

  it("does not invent progress when no percentage is reported", () => {
    const html = renderToStaticMarkup(
      <StatusBox message="Rendering on a HavnAI node..." />
    );

    expect(html).not.toContain('role="progressbar"');
  });
});
