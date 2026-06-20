import { describe, expect, it } from "vitest";

import { analyze, parseConfig } from "../src/index.js";
import { attachFindingIds, createFindingId } from "../src/finding/id.js";
import { createAnalysisInput, fileChange } from "./helpers.js";

describe("finding IDs", () => {
  const rawWorkflowFinding = {
    ruleId: "workflow/permission-escalation",
    severity: "error" as const,
    title: "Workflow permissions escalated",
    message: "Workflow permissions changed from read to write.",
    path: ".github/workflows/release.yml",
    evidence: [
      { label: "permission", value: "contents" },
      { label: "before", value: "read" },
      { label: "after", value: "write" },
    ],
    remediation: ["Review the workflow before merging."],
    tags: ["workflow"],
    confidence: "high" as const,
  };

  it("assigns stable finding IDs to analyzed findings", async () => {
    const input = createAnalysisInput({
      config: parseConfig("version: 1\nmode: block\n"),
      files: [fileChange("AGENTS.md")],
    });

    const first = await analyze(input);
    const second = await analyze(input);

    expect(first.findings[0]?.findingId).toMatch(/^agf_[0-9a-f]{16}$/);
    expect(first.findings[0]?.findingId).toBe(second.findings[0]?.findingId);
  });

  it("attaches re-derivable evidence snapshots next to finding IDs", () => {
    const [finding] = attachFindingIds([rawWorkflowFinding]);

    expect(finding?.findingId).toMatch(/^agf_[0-9a-f]{16}$/);
    expect(finding?.evidenceSnapshot).toEqual({
      ruleId: "workflow/permission-escalation",
      severity: "error",
      path: ".github/workflows/release.yml",
      evidence: [
        { label: "after", value: "write" },
        { label: "before", value: "read" },
        { label: "permission", value: "contents" },
      ],
    });
  });

  it("keeps evidence snapshots stable across evidence ordering and analysis metadata", async () => {
    const [first] = attachFindingIds([rawWorkflowFinding]);
    const [reordered] = attachFindingIds([
      {
        ...rawWorkflowFinding,
        evidence: [...rawWorkflowFinding.evidence].reverse(),
      },
    ]);

    expect(first?.evidenceSnapshot).toEqual(reordered?.evidenceSnapshot);

    const input = createAnalysisInput({
      config: parseConfig("version: 1\nmode: block\n"),
      files: [fileChange("AGENTS.md")],
    });
    const laterInput = {
      ...input,
      now: "2026-06-14T00:00:00.000Z",
      version: "9.9.9",
    };

    const initial = await analyze(input);
    const later = await analyze(laterInput);

    expect(initial.findings[0]?.evidenceSnapshot).toEqual(later.findings[0]?.evidenceSnapshot);
  });

  it("changes evidence snapshots when stable finding inputs change", () => {
    const [base] = attachFindingIds([rawWorkflowFinding]);
    const [pathChanged] = attachFindingIds([
      {
        ...rawWorkflowFinding,
        path: ".github/workflows/deploy.yml",
      },
    ]);
    const [evidenceChanged] = attachFindingIds([
      {
        ...rawWorkflowFinding,
        evidence: [
          { label: "permission", value: "contents" },
          { label: "before", value: "read" },
          { label: "after", value: "admin" },
        ],
      },
    ]);

    expect(base?.evidenceSnapshot).not.toEqual(pathChanged?.evidenceSnapshot);
    expect(base?.evidenceSnapshot).not.toEqual(evidenceChanged?.evidenceSnapshot);
  });

  it("keeps mutable display and report metadata out of evidence snapshots", () => {
    const [finding] = attachFindingIds([rawWorkflowFinding]);

    expect(finding?.evidenceSnapshot).not.toHaveProperty("title");
    expect(finding?.evidenceSnapshot).not.toHaveProperty("message");
    expect(finding?.evidenceSnapshot).not.toHaveProperty("remediation");
    expect(finding?.evidenceSnapshot).not.toHaveProperty("tags");
    expect(finding?.evidenceSnapshot).not.toHaveProperty("confidence");
    expect(finding?.evidenceSnapshot).not.toHaveProperty("riskScore");
    expect(finding?.evidenceSnapshot).not.toHaveProperty("version");
    expect(finding?.evidenceSnapshot).not.toHaveProperty("analyzedAt");
  });

  it("changes finding IDs when stable finding evidence changes", () => {
    expect(createFindingId(rawWorkflowFinding)).not.toBe(
      createFindingId({
        ...rawWorkflowFinding,
        path: ".github/workflows/deploy.yml",
      }),
    );
    expect(createFindingId(rawWorkflowFinding)).not.toBe(
      createFindingId({
        ...rawWorkflowFinding,
        evidence: [
          { label: "permission", value: "contents" },
          { label: "before", value: "read" },
          { label: "after", value: "admin" },
        ],
      }),
    );
  });

  it("keeps finding IDs stable across evidence ordering and analysis metadata", async () => {
    expect(createFindingId(rawWorkflowFinding)).toBe(
      createFindingId({
        ...rawWorkflowFinding,
        evidence: [...rawWorkflowFinding.evidence].reverse(),
      }),
    );

    const input = createAnalysisInput({
      config: parseConfig("version: 1\nmode: block\n"),
      files: [fileChange("AGENTS.md")],
    });
    const laterInput = {
      ...input,
      now: "2026-06-14T00:00:00.000Z",
      version: "9.9.9",
    };

    const first = await analyze(input);
    const later = await analyze(laterInput);

    expect(first.findings[0]?.findingId).toBe(later.findings[0]?.findingId);
  });
});
