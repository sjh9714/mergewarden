import { describe, expect, it } from "vitest";

import { analyze, renderJsonReport, renderMarkdownReport } from "../src/index.js";
import { createAnalysisInput } from "./helpers.js";

describe("report renderers", () => {
  it("renders JSON that parses back into the analysis result", async () => {
    const result = await analyze(createAnalysisInput());

    expect(JSON.parse(renderJsonReport(result))).toEqual(result);
  });

  it("renders a readable Markdown report for an empty pass result", async () => {
    const result = await analyze(createAnalysisInput());

    const markdown = renderMarkdownReport(result);

    expect(markdown).toContain("# Agent Gate Report");
    expect(markdown).toContain("Decision: PASS");
    expect(markdown).toContain("Risk score: 0 / 100");
    expect(markdown).toContain("- Agent detected: no");
    expect(markdown).toContain("- Contract present: no");
    expect(markdown).toContain("No findings.");
  });
});
