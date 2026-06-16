import { describe, expect, it } from "vitest";

import {
  analyze,
  type AnalysisResult,
  renderJsonReport,
  renderMarkdownReport,
  renderPlainTextReportSummary,
} from "../src/index.js";
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

  it("renders a compact plain-text summary for warn results", () => {
    const result = {
      decision: "warn" as const,
      riskScore: 89,
      summary: {
        title: "Agent Gate: warning",
        agentDetected: true,
        contractPresent: true,
        errorCount: 1,
        warnCount: 1,
        infoCount: 0,
      },
      findings: [
        {
          ruleId: "workflow/permission-escalation",
          severity: "error" as const,
          title: "Workflow permissions escalated",
          message: "Workflow permissions changed from read to write.",
          path: ".github/workflows/release.yml",
          evidence: [
            {
              label: "permission",
              value: "contents: write",
            },
          ],
          remediation: ["Review the workflow before merging."],
          tags: ["workflow"],
          confidence: "high" as const,
        },
        {
          ruleId: "evidence/missing-test-change",
          severity: "warn" as const,
          title: "Missing test evidence",
          message: "src/auth/session.ts changed without matching test evidence.",
          path: "src/auth/session.ts",
          evidence: [],
          remediation: [],
          tags: ["evidence"],
          confidence: "medium" as const,
        },
      ],
      metadata,
    };

    const summary = renderPlainTextReportSummary(result);

    expect(summary).toContain("Agent Gate: NEEDS HUMAN DECISION");
    expect(summary).toContain("Decision: warn");
    expect(summary).toContain("Risk score: 89 / 100");
    expect(summary).toContain("Why: Workflow permissions changed from read to write.");
    expect(summary).toContain("Path: .github/workflows/release.yml");
    expect(summary).toContain("Recommended next step: Review the workflow change before merging.");
    expect(summary).toContain(
      "Policy status: warning today; eligible to become a merge gate after tuning.",
    );
    expect(summary).toContain(
      "- error workflow/permission-escalation .github/workflows/release.yml",
    );
    expect(summary).toContain("- warn evidence/missing-test-change src/auth/session.ts");
    expect(summary).not.toContain("Evidence:");
    expect(summary).not.toContain("Remediation:");
    expect(JSON.parse(renderJsonReport(result))).toMatchObject({ decision: "warn" });
  });

  it("keeps the top summary action-oriented for info-only pass results", () => {
    const result: AnalysisResult = {
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
    };
    const markdown = renderMarkdownReport(result);
    const plainText = renderPlainTextReportSummary(result);

    expect(markdown).toContain("# Agent Gate: PASSED");
    expect(markdown).toContain("No warning or blocking findings were detected.");
    expect(markdown).toContain("### INFO agent/origin-detected");
    expect(plainText).toContain("Agent Gate: PASSED");
    expect(plainText).toContain("Why: No warning or blocking findings were detected.");
    expect(plainText).toContain("- info agent/origin-detected");
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

  it("normalizes and truncates untrusted values in plain-text summaries", () => {
    const longValue = "a".repeat(520);
    const result = {
      decision: "warn" as const,
      riskScore: 10,
      summary: {
        title: "Agent Gate: warning",
        agentDetected: true,
        contractPresent: true,
        errorCount: 0,
        warnCount: 11,
        infoCount: 0,
      },
      findings: Array.from({ length: 11 }, (_, index) => ({
        ruleId: index === 0 ? "evidence/missing-test-change" : `test/rule-${index}`,
        severity: "warn" as const,
        title: "Finding",
        message:
          index === 0 ? `Changed risky file.\n<!-- hidden -->\n${longValue}` : `Finding ${index}`,
        path: index === 0 ? "src/auth/session.ts\n<!-- hidden -->" : `src/file-${index}.ts`,
        evidence: [
          {
            label: "evidence",
            value: "not printed",
          },
        ],
        remediation: ["not printed"],
        tags: ["test"],
        confidence: "medium" as const,
      })),
      metadata,
    };

    const summary = renderPlainTextReportSummary(result);

    expect(summary).toContain("Changed risky file.\\n&lt;!-- hidden --&gt;");
    expect(summary).toContain("Path: src/auth/session.ts\\n&lt;!-- hidden --&gt;");
    expect(summary).toContain("…");
    expect(summary).toContain("... 1 more findings omitted");
    expect(summary).not.toContain("<!-- hidden -->");
    expect(summary).not.toContain("not printed");
  });

  it("renders finding severity, rule id, and path in Markdown reports", () => {
    const result: AnalysisResult = {
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
    };
    const markdown = renderMarkdownReport(result);
    const plainText = renderPlainTextReportSummary(result);

    expect(markdown).toContain("# Agent Gate: BLOCKED");
    expect(markdown).toContain("Decision: block");
    expect(markdown).toContain("Review or split the out-of-scope file changes before merging.");
    expect(markdown).toContain("### ERROR contract/out-of-scope");
    expect(markdown).toContain("Path: `src/payments/webhook.ts`");
    expect(plainText).toContain("Agent Gate: BLOCKED");
    expect(plainText).toContain("Decision: block");
  });
});
