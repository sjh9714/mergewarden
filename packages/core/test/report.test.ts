import { describe, expect, it } from "vitest";

import {
  analyze,
  type AnalysisResult,
  type Decision,
  type Finding,
  type RawFinding,
  parseConfig,
  renderJsonReport,
  renderMarkdownReport,
  renderPlainTextReportSummary,
} from "../src/index.js";
import { attachFindingIds } from "../src/finding/id.js";
import { createAnalysisInput, fileChange } from "./helpers.js";

describe("report renderers", () => {
  const metadata = {
    analyzedAt: "2026-06-13T00:00:00.000Z",
    baseSha: "base-sha",
    headSha: "head-sha",
    configSource: "local" as const,
    version: "0.0.0",
    analysisComplete: true,
    expectedFileCount: 1,
    analyzedFileCount: 1,
    contentFileCount: 1,
    policyDigest: "test-policy-digest",
    engineVersion: "0.0.0",
    runtimeRef: "0.0.0",
    totalFindingCount: 1,
    omittedFindingCount: 0,
  };

  function reportResult(value: {
    decision: Decision;
    riskScore: number;
    summary: Omit<AnalysisResult["summary"], "waivedCount">;
    findings: Finding[];
    metadata?: Partial<AnalysisResult["metadata"]>;
  }): AnalysisResult {
    const status =
      value.decision === "block"
        ? "blocked"
        : value.decision === "warn"
          ? "needs-review"
          : "passed";

    return {
      ...value,
      status,
      summary: { ...value.summary, waivedCount: 0 },
      waivedFindings: [],
      metadata: { ...metadata, ...value.metadata },
    };
  }

  function finding(rawFinding: RawFinding) {
    const [enrichedFinding] = attachFindingIds([rawFinding]);

    if (!enrichedFinding) {
      throw new Error("Expected enriched finding");
    }

    return enrichedFinding;
  }

  it("renders JSON that parses back into the analysis result", async () => {
    const result = await analyze(createAnalysisInput());

    expect(JSON.parse(renderJsonReport(result))).toEqual(result);
  });

  it("keeps JSON valid and within the two-megabyte surface limit", () => {
    const findings = Array.from({ length: 250 }, (_, index) =>
      finding({
        ruleId: `test/large-${index}`,
        severity: "error",
        title: "T".repeat(2_048),
        message: "M".repeat(2_048),
        path: `src/${index}-${"p".repeat(2_048)}.ts`,
        evidence: [
          { label: "large", value: `${index}-${"e".repeat(2_048)}` },
          { label: "second", value: `${index}-${"v".repeat(2_048)}` },
        ],
        remediation: ["R".repeat(2_048)],
        tags: ["large-report"],
        confidence: "high",
      }),
    );
    const result = reportResult({
      decision: "block",
      riskScore: 100,
      summary: {
        title: "MergeWarden: blocked",
        agentDetected: false,
        contractPresent: false,
        errorCount: findings.length,
        warnCount: 0,
        infoCount: 0,
      },
      findings,
      metadata: { totalFindingCount: findings.length },
    });

    const report = renderJsonReport(result);
    const parsed = JSON.parse(report) as AnalysisResult;

    expect(Buffer.byteLength(report, "utf8")).toBeLessThanOrEqual(2_000_000);
    expect(parsed.findings.length).toBeLessThan(findings.length);
    expect(parsed.metadata.totalFindingCount).toBe(findings.length);
    expect(parsed.metadata.omittedFindingCount).toBe(findings.length - parsed.findings.length);
    expect(parsed.status).toBe("blocked");
  });

  it("keeps Markdown within its byte cap using whole findings and an exact omission count", () => {
    const findings = Array.from({ length: 24 }, (_, index) =>
      finding({
        ruleId: `test/markdown-cap-${String(index).padStart(2, "0")}`,
        severity: "error",
        title: `Large finding ${index}`,
        message: `${index}-${"m".repeat(1_500)}`,
        path: `src/large-${index}.ts`,
        evidence: [{ label: "payload", value: `${index}-${"e".repeat(1_500)}` }],
        remediation: [`${index}-${"r".repeat(1_500)}`],
        tags: ["large-report"],
        confidence: "high",
      }),
    );
    const result = reportResult({
      decision: "block",
      riskScore: 100,
      summary: {
        title: "MergeWarden: blocked",
        agentDetected: false,
        contractPresent: false,
        errorCount: findings.length + 2,
        warnCount: 0,
        infoCount: 0,
      },
      findings,
      metadata: {
        totalFindingCount: findings.length + 2,
        omittedFindingCount: 2,
      },
    });

    const report = renderMarkdownReport(result, {
      maxFindings: findings.length,
      maxBytes: 12_000,
      fullReportPath: "mergewarden-report.md",
    });
    const visibleFindingCount = (report.match(/^### ERROR test\/markdown-cap-/gm) ?? []).length;
    const expectedOmitted = 2 + findings.length - visibleFindingCount;

    expect(Buffer.byteLength(report, "utf8")).toBeLessThanOrEqual(12_000);
    expect(visibleFindingCount).toBeGreaterThan(0);
    expect(visibleFindingCount).toBeLessThan(findings.length);
    expect(report.match(/^Finding ID:/gm)).toHaveLength(visibleFindingCount);
    expect(report).toContain(`_${expectedOmitted} findings omitted from this surface._`);
    expect(report).toContain("Full report: mergewarden-report.md");
    expect(report).not.toContain("Report truncated");
  });

  it("renders default config source metadata in JSON reports", () => {
    const result = reportResult({
      decision: "pass",
      riskScore: 0,
      summary: {
        title: "MergeWarden: passed",
        agentDetected: false,
        contractPresent: false,
        errorCount: 0,
        warnCount: 0,
        infoCount: 0,
      },
      findings: [],
      metadata: { configSource: "default" },
    });

    expect(JSON.parse(renderJsonReport(result)).metadata.configSource).toBe("default");
  });

  it("renders evidence snapshots in JSON reports", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        files: [fileChange("AGENTS.md")],
      }),
    );

    const parsed = JSON.parse(renderJsonReport(result));

    expect(parsed.findings[0].findingId).toMatch(/^agf_[0-9a-f]{16}$/);
    expect(parsed.findings[0].evidenceSnapshot).toMatchObject({
      ruleId: parsed.findings[0].ruleId,
      severity: parsed.findings[0].severity,
      path: parsed.findings[0].path,
    });
    expect(parsed.findings[0].evidenceSnapshot.evidence).toEqual(
      [...parsed.findings[0].evidence].sort((left, right) => {
        if (left.label !== right.label) {
          return left.label.localeCompare(right.label);
        }

        return left.value.localeCompare(right.value);
      }),
    );
    expect(parsed.findings[0].evidenceSnapshot).not.toHaveProperty("message");
    expect(parsed.findings[0].evidenceSnapshot).not.toHaveProperty("remediation");
  });

  it("renders a readable Markdown report for an empty pass result", async () => {
    const result = await analyze(createAnalysisInput());

    const markdown = renderMarkdownReport(result);

    expect(markdown).toContain("# MergeWarden: PASSED");
    expect(markdown).toContain("Decision: pass");
    expect(markdown).not.toContain("Risk score:");
    expect(markdown).toContain("No active warning or blocking findings were detected.");
    expect(markdown).toContain("Policy status: no active blocking or warning findings.");
    expect(markdown).toContain("- Agent detected: no");
    expect(markdown).toContain("- PR-declared contract present: no");
    expect(markdown).toContain("- Policy source: local fixture");
    expect(markdown).toContain("No active findings.");
  });

  it("renders a human-decision-first Markdown report for warn results", () => {
    const result = reportResult({
      decision: "warn" as const,
      riskScore: 10,
      summary: {
        title: "MergeWarden: warning",
        agentDetected: true,
        contractPresent: true,
        errorCount: 0,
        warnCount: 1,
        infoCount: 0,
      },
      findings: [
        finding({
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
        }),
      ],
      metadata,
    });
    const markdown = renderMarkdownReport(result);

    expect(markdown).toContain("# MergeWarden: NEEDS REVIEW");
    expect(markdown).toContain("Decision: warn");
    expect(markdown).toContain("## Recommended Next Step");
    expect(markdown).toContain("Add or review matching test evidence before merging.");
    expect(markdown).toContain("## Policy Status");
    expect(markdown).toContain(
      "Policy status: warning today; eligible to become a merge gate after tuning.",
    );
    expect(markdown).toContain("Evidence:");
    expect(markdown).toContain("Snapshot:");
    expect(markdown).toContain("- ruleId: evidence/missing-test-change");
    expect(markdown).toContain("- severity: warn");
    expect(markdown).toContain("- path: src/auth/session.ts");
    expect(markdown).toContain("- Policy source: local fixture");
    expect(markdown).toContain("- required tests: tests/auth/\\*\\*");
    expect(markdown).toContain("Remediation:");
    expect(markdown).toContain("- Add or update matching auth tests.");
    expect(JSON.parse(renderJsonReport(result))).toMatchObject({ decision: "warn" });
  });

  it("renders a compact plain-text summary for warn results", () => {
    const result = reportResult({
      decision: "warn" as const,
      riskScore: 89,
      summary: {
        title: "MergeWarden: warning",
        agentDetected: true,
        contractPresent: true,
        errorCount: 1,
        warnCount: 1,
        infoCount: 0,
      },
      findings: [
        finding({
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
        }),
        finding({
          ruleId: "evidence/missing-test-change",
          severity: "warn" as const,
          title: "Missing test evidence",
          message: "src/auth/session.ts changed without matching test evidence.",
          path: "src/auth/session.ts",
          evidence: [],
          remediation: [],
          tags: ["evidence"],
          confidence: "medium" as const,
        }),
      ],
      metadata,
    });

    const summary = renderPlainTextReportSummary(result);
    const workflowFinding = result.findings[0];
    const evidenceFinding = result.findings[1];

    if (!workflowFinding || !evidenceFinding) {
      throw new Error("Expected warn report fixture to include two findings");
    }

    expect(summary).toContain("MergeWarden: NEEDS REVIEW");
    expect(summary).toContain("Decision: warn");
    expect(summary).not.toContain("Risk score:");
    expect(summary).toContain("Why: Workflow permissions changed from read to write.");
    expect(summary).toContain("Path: .github/workflows/release.yml");
    expect(summary).toContain("Recommended next step: Review the workflow change before merging.");
    expect(summary).toContain(
      "Policy status: warning today; eligible to become a merge gate after tuning.",
    );
    expect(summary).toContain(
      `- error ${workflowFinding.findingId} workflow/permission-escalation .github/workflows/release.yml`,
    );
    expect(summary).toContain(
      `- warn ${evidenceFinding.findingId} evidence/missing-test-change src/auth/session.ts`,
    );
    expect(summary).not.toContain("Snapshot:");
    expect(summary).not.toContain("Evidence:");
    expect(summary).not.toContain("Remediation:");
    expect(JSON.parse(renderJsonReport(result))).toMatchObject({ decision: "warn" });
  });

  it("renders package lifecycle script findings across report formats", async () => {
    const result = await analyze(
      createAnalysisInput({
        files: [
          {
            path: "package.json",
            status: "modified",
            additions: 4,
            deletions: 1,
            baseContent: JSON.stringify({ scripts: { test: "vitest" } }),
            headContent: JSON.stringify({
              scripts: { test: "vitest", preinstall: "node scripts/setup.js" },
            }),
          },
        ],
      }),
    );
    const finding = result.findings[0];

    if (!finding) {
      throw new Error("Expected package script finding");
    }

    const json = JSON.parse(renderJsonReport(result));
    const markdown = renderMarkdownReport(result);
    const plainText = renderPlainTextReportSummary(result);

    expect(result.decision).toBe("warn");
    expect(finding.ruleId).toBe("dependency/lifecycle-script-added");
    expect(json.findings[0].evidenceSnapshot).toMatchObject({
      ruleId: "dependency/lifecycle-script-added",
      severity: "warn",
      path: "package.json",
    });
    expect(markdown).toContain("### WARN dependency/lifecycle-script-added");
    expect(markdown).toContain("Finding ID: agf_");
    expect(markdown).toContain("- script: preinstall");
    expect(markdown).toContain("- after: node scripts/setup.js");
    expect(plainText).toContain(
      `- warn ${finding.findingId} dependency/lifecycle-script-added package.json`,
    );
    expect(plainText).not.toContain("evidenceSnapshot");
    expect(plainText).not.toContain("node scripts/setup.js");
  });

  it("keeps the top summary action-oriented for info-only pass results", () => {
    const result = reportResult({
      decision: "pass",
      riskScore: 1,
      summary: {
        title: "MergeWarden: passed",
        agentDetected: true,
        contractPresent: false,
        errorCount: 0,
        warnCount: 0,
        infoCount: 1,
      },
      findings: [
        finding({
          ruleId: "agent/origin-detected",
          severity: "info",
          title: "Agent origin detected",
          message: "This PR appears to be agent-generated.",
          evidence: [],
          remediation: [],
          tags: ["agent"],
          confidence: "medium",
        }),
      ],
      metadata,
    });
    const markdown = renderMarkdownReport(result);
    const plainText = renderPlainTextReportSummary(result);
    const infoFinding = result.findings[0];

    if (!infoFinding) {
      throw new Error("Expected info-only report fixture to include one finding");
    }

    expect(markdown).toContain("# MergeWarden: PASSED");
    expect(markdown).toContain("No active warning or blocking findings were detected.");
    expect(markdown).toContain("### INFO agent/origin-detected");
    expect(plainText).toContain("MergeWarden: PASSED");
    expect(plainText).toContain("Why: No warning or blocking findings were detected.");
    expect(plainText).toContain(`- info ${infoFinding.findingId} agent/origin-detected`);
  });

  it("normalizes untrusted Markdown values in finding details", () => {
    const longValue = "a".repeat(3_000);
    const markdown = renderMarkdownReport(
      reportResult({
        decision: "warn",
        riskScore: 10,
        summary: {
          title: "MergeWarden: warning",
          agentDetected: true,
          contractPresent: true,
          errorCount: 0,
          warnCount: 1,
          infoCount: 0,
        },
        findings: [
          finding({
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
          }),
        ],
        metadata,
      }),
    );

    expect(markdown).toContain("Path: src/auth/session.ts\\n&lt;!-- hidden --&gt;");
    expect(markdown).toContain("- required\\ntests: tests/auth/\\*\\*\\n&lt;!-- comment --&gt;");
    expect(markdown).toContain("…");
    expect(markdown).not.toContain("<!-- hidden -->");
    expect(markdown).not.toContain("<!-- comment -->");
    expect(markdown).toContain("- Add matching tests.\\n&lt;!-- do not render as comment --&gt;");
  });

  it.each(["- injected list", "+ injected list", "1. injected list", "# injected heading"])(
    "renders standalone Markdown control text as data: %s",
    (message) => {
      const result = reportResult({
        decision: "warn",
        riskScore: 1,
        summary: {
          title: "MergeWarden: warning",
          agentDetected: false,
          contractPresent: false,
          errorCount: 0,
          warnCount: 1,
          infoCount: 0,
        },
        findings: [
          finding({
            ruleId: "test/markdown-data",
            severity: "warn",
            title: "Markdown data",
            message,
            evidence: [],
            remediation: [],
            tags: ["test"],
            confidence: "high",
          }),
        ],
      });

      const markdown = renderMarkdownReport(result);
      expect(markdown).not.toContain(`\n${message}\n`);
    },
  );

  it("normalizes and truncates untrusted values in plain-text summaries", () => {
    const longValue = "a".repeat(3_000);
    const result = reportResult({
      decision: "warn" as const,
      riskScore: 10,
      summary: {
        title: "MergeWarden: warning",
        agentDetected: true,
        contractPresent: true,
        errorCount: 0,
        warnCount: 11,
        infoCount: 0,
      },
      findings: Array.from({ length: 11 }, (_, index) =>
        finding({
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
        }),
      ),
      metadata,
    });

    const summary = renderPlainTextReportSummary(result);

    expect(summary).toContain("Changed risky file.\\n&lt;!-- hidden --&gt;");
    expect(summary).toContain("Path: src/auth/session.ts\\n&lt;!-- hidden --&gt;");
    expect(summary).toContain("…");
    expect(summary).toContain("... 1 more findings omitted");
    expect(summary).not.toContain("<!-- hidden -->");
    expect(summary).not.toContain("not printed");
  });

  it("renders finding severity, rule id, and path in Markdown reports", () => {
    const result = reportResult({
      decision: "block",
      riskScore: 20,
      summary: {
        title: "MergeWarden: blocked",
        agentDetected: false,
        contractPresent: true,
        errorCount: 1,
        warnCount: 0,
        infoCount: 0,
      },
      findings: [
        finding({
          ruleId: "contract/out-of-scope",
          severity: "error",
          title: "File changed outside contract scope",
          message: "src/payments/webhook.ts changed outside allowed paths.",
          path: "src/payments/webhook.ts",
          evidence: [],
          remediation: [],
          tags: ["contract"],
          confidence: "high",
        }),
      ],
      metadata,
    });
    const markdown = renderMarkdownReport(result);
    const plainText = renderPlainTextReportSummary(result);

    expect(markdown).toContain("# MergeWarden: BLOCKED");
    expect(markdown).toContain("Decision: block");
    expect(markdown).toContain("Review or split the out-of-scope file changes before merging.");
    expect(markdown).toContain("### ERROR contract/out-of-scope");
    expect(markdown).toContain("Finding ID: agf_");
    expect(markdown).toContain("Path: src/payments/webhook.ts");
    expect(plainText).toContain("MergeWarden: BLOCKED");
    expect(plainText).toContain("Decision: block");
    expect(plainText).toContain("agf_");
  });

  it("includes finding IDs in JSON, Markdown, and plain-text reports", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        files: [fileChange("AGENTS.md")],
      }),
    );

    const findingId = result.findings[0]?.findingId;

    expect(findingId).toMatch(/^agf_[0-9a-f]{16}$/);
    expect(JSON.parse(renderJsonReport(result)).findings[0].findingId).toBe(findingId);
    expect(renderMarkdownReport(result)).toContain(`Finding ID: ${findingId}`);
    expect(renderPlainTextReportSummary(result)).toContain(findingId);
  });

  it("includes evidence snapshots in JSON and Markdown reports without expanding plain text", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        files: [fileChange("AGENTS.md")],
      }),
    );

    const parsed = JSON.parse(renderJsonReport(result));
    const markdown = renderMarkdownReport(result);
    const plainText = renderPlainTextReportSummary(result);

    expect(parsed.findings[0].evidenceSnapshot).toEqual(result.findings[0]?.evidenceSnapshot);
    expect(markdown).toContain("Snapshot:");
    expect(markdown).toContain(`- ruleId: ${result.findings[0]?.ruleId}`);
    expect(markdown).toContain(`- severity: ${result.findings[0]?.severity}`);
    expect(plainText).not.toContain("Snapshot:");
    expect(plainText).not.toContain("evidenceSnapshot");
  });
});
