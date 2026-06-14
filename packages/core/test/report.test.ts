import { describe, expect, it } from "vitest";

import { analyze, renderJsonReport, renderMarkdownReport } from "../src/index.js";
import { createAnalysisInput } from "./helpers.js";

describe("report renderers", () => {
  const metadata = {
    analyzedAt: "2026-06-13T00:00:00.000Z",
    baseSha: "base-sha",
    headSha: "head-sha",
    configSource: "local" as const,
    version: "0.0.0",
  };

  it("renders JSON that parses back into the analysis result", async () => {
    const result = await analyze(createAnalysisInput());

    expect(JSON.parse(renderJsonReport(result))).toEqual(result);
  });

  it("renders a readable Markdown report for an empty pass result", async () => {
    const result = await analyze(createAnalysisInput());

    const markdown = renderMarkdownReport(result);

    expect(markdown).toContain("# Agent Gate: PASSED");
    expect(markdown).toContain("Decision: pass");
    expect(markdown).toContain("Risk score: 0 / 100");
    expect(markdown).toContain("No warning or blocking findings were detected.");
    expect(markdown).toContain("Policy status: no blocking or warning findings.");
    expect(markdown).toContain("- Agent detected: no");
    expect(markdown).toContain("- Contract present: no");
    expect(markdown).toContain("No findings.");
  });

  it("renders a human-decision-first Markdown report for warn results", () => {
    const result = {
      decision: "warn" as const,
      riskScore: 10,
      summary: {
        title: "Agent Gate: warning",
        agentDetected: true,
        contractPresent: true,
        errorCount: 0,
        warnCount: 1,
        infoCount: 0,
      },
      findings: [
        {
          ruleId: "evidence/missing-test-change",
          severity: "warn" as const,
          title: "Missing test evidence",
          message: "src/auth/session.ts changed without matching test evidence.",
          path: "src/auth/session.ts",
          evidence: [
            {
              label: "required tests",
              value: "tests/auth/**",
            },
          ],
          remediation: ["Add or update matching auth tests."],
          tags: ["evidence"],
          confidence: "medium" as const,
        },
      ],
      metadata,
    };
    const markdown = renderMarkdownReport(result);

    expect(markdown).toContain("# Agent Gate: NEEDS HUMAN DECISION");
    expect(markdown).toContain("Decision: warn");
    expect(markdown).toContain("## Recommended Next Step");
    expect(markdown).toContain("Add or review matching test evidence before merging.");
    expect(markdown).toContain("## Policy Status");
    expect(markdown).toContain(
      "Policy status: warning today; eligible to become a merge gate after tuning.",
    );
    expect(markdown).toContain("Evidence:");
    expect(markdown).toContain("- required tests: tests/auth/**");
    expect(markdown).toContain("Remediation:");
    expect(markdown).toContain("- Add or update matching auth tests.");
    expect(JSON.parse(renderJsonReport(result))).toMatchObject({ decision: "warn" });
  });

  it("keeps the top summary action-oriented for info-only pass results", () => {
    const markdown = renderMarkdownReport({
      decision: "pass",
      riskScore: 1,
      summary: {
        title: "Agent Gate: passed",
        agentDetected: true,
        contractPresent: false,
        errorCount: 0,
        warnCount: 0,
        infoCount: 1,
      },
      findings: [
        {
          ruleId: "agent/origin-detected",
          severity: "info",
          title: "Agent origin detected",
          message: "This PR appears to be agent-generated.",
          evidence: [],
          remediation: [],
          tags: ["agent"],
          confidence: "medium",
        },
      ],
      metadata,
    });

    expect(markdown).toContain("# Agent Gate: PASSED");
    expect(markdown).toContain("No warning or blocking findings were detected.");
    expect(markdown).toContain("### INFO agent/origin-detected");
  });

  it("normalizes untrusted Markdown values in finding details", () => {
    const longValue = "a".repeat(520);
    const markdown = renderMarkdownReport({
      decision: "warn",
      riskScore: 10,
      summary: {
        title: "Agent Gate: warning",
        agentDetected: true,
        contractPresent: true,
        errorCount: 0,
        warnCount: 1,
        infoCount: 0,
      },
      findings: [
        {
          ruleId: "evidence/missing-test-change",
          severity: "warn",
          title: "Missing test evidence",
          message: "src/auth/session.ts changed without matching test evidence.",
          path: "src/auth/session.ts\n<!-- hidden -->",
          evidence: [
            {
              label: "required\ntests",
              value: `tests/auth/**\n<!-- comment -->\n${longValue}`,
            },
          ],
          remediation: ["Add matching tests.\n<!-- do not render as comment -->"],
          tags: ["evidence"],
          confidence: "medium",
        },
      ],
      metadata,
    });

    expect(markdown).toContain("Path: `src/auth/session.ts\\n&lt;!-- hidden --&gt;`");
    expect(markdown).toContain("- required\\ntests: tests/auth/**\\n&lt;!-- comment --&gt;");
    expect(markdown).toContain("…");
    expect(markdown).not.toContain("<!-- hidden -->");
    expect(markdown).not.toContain("<!-- comment -->");
    expect(markdown).toContain("- Add matching tests.\\n&lt;!-- do not render as comment --&gt;");
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
      metadata,
    });

    expect(markdown).toContain("# Agent Gate: BLOCKED");
    expect(markdown).toContain("Decision: block");
    expect(markdown).toContain("Review or split the out-of-scope file changes before merging.");
    expect(markdown).toContain("### ERROR contract/out-of-scope");
    expect(markdown).toContain("Path: `src/payments/webhook.ts`");
  });
});
