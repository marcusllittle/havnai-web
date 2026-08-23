import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ImageMaskEditor } from "../ImageMaskEditor";

describe("ImageMaskEditor", () => {
  it("renders a stable mask surface with paint, erase, brush, and clear controls", () => {
    const html = renderToStaticMarkup(
      <ImageMaskEditor src="data:image/png;base64,reference" onMaskChange={() => undefined} />
    );

    expect(html).toContain("image-mask-stage");
    expect(html).toContain("Selected image area");
    expect(html).toContain("Paint");
    expect(html).toContain("Erase");
    expect(html).toContain('type="range"');
    expect(html).toContain("Clear");
  });
});
