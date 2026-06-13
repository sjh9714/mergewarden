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

  it("renders finding severity, rule id, and path in Markdown reports", () => {
    const markdown = renderMarkdownReport({
      decision: "block",
      riskScore: 20,
      summary: {
        title: "Agent Gate: blocked",
        agentDetected: false,
        contractPresent: true,
        errorCount: 1,
        warnCount: 0,
        infoCount: 0,
      },
      findings: [
        {
          ruleId: "contract/out-of-scope",
          severity: "error",
          title: "File changed outside contract scope",
          message: "src/payments/webhook.ts changed outside allowed paths.",
          path: "src/payments/webhook.ts",
          evidence: [],
          remediation: [],
          tags: ["contract"],
          confidence: "high",
        },
      ],
      metadata: {
        analyzedAt: "2026-06-13T00:00:00.000Z",
        baseSha: "base-sha",
        headSha: "head-sha",
        configSource: "local",
        version: "0.0.0",
      },
    });

    expect(markdown).toContain("### ERROR contract/out-of-scope");
    expect(markdown).toContain("Path: `src/payments/webhook.ts`");
  });
});
