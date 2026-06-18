import { describe, expect, it } from "vitest";

import { analyze, parseConfig } from "../src/index.js";
import { createFindingId } from "../src/finding/id.js";
import { createAnalysisInput, fileChange } from "./helpers.js";

describe("finding IDs", () => {
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

  it("changes finding IDs when stable finding evidence changes", () => {
    const baseFinding = {
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

    expect(createFindingId(baseFinding)).not.toBe(
      createFindingId({
        ...baseFinding,
        path: ".github/workflows/deploy.yml",
      }),
    );
    expect(createFindingId(baseFinding)).not.toBe(
      createFindingId({
        ...baseFinding,
        evidence: [
          { label: "permission", value: "contents" },
          { label: "before", value: "read" },
          { label: "after", value: "admin" },
        ],
      }),
    );
  });

  it("keeps finding IDs stable across evidence ordering and analysis metadata", async () => {
    const baseFinding = {
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

    expect(createFindingId(baseFinding)).toBe(
      createFindingId({
        ...baseFinding,
        evidence: [...baseFinding.evidence].reverse(),
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
