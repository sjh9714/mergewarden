import { createHash } from "node:crypto";

import type { Finding, RawFinding } from "../types.js";

function normalizeStableText(value: string): string {
  return value.normalize("NFC").replace(/\r\n?/g, "\n");
}

function sortedEvidence(finding: RawFinding): Array<{ label: string; value: string }> {
  return finding.evidence
    .map((item) => ({
      label: normalizeStableText(item.label),
      value: normalizeStableText(item.value),
    }))
    .sort((left, right) => {
      if (left.label < right.label) {
        return -1;
      }

      if (left.label > right.label) {
        return 1;
      }

      if (left.value < right.value) {
        return -1;
      }

      if (left.value > right.value) {
        return 1;
      }

      return 0;
    });
}

export function createFindingId(finding: RawFinding): string {
  const stableInput = {
    ruleId: finding.ruleId,
    severity: finding.severity,
    ...(finding.path ? { path: normalizeStableText(finding.path) } : {}),
    ...(finding.line !== undefined ? { line: finding.line } : {}),
    evidence: sortedEvidence(finding),
  };
  const hash = createHash("sha256").update(JSON.stringify(stableInput)).digest("hex").slice(0, 16);

  return `agf_${hash}`;
}

export function attachFindingIds(findings: RawFinding[]): Finding[] {
  return findings.map((finding) => ({
    ...finding,
    findingId: createFindingId(finding),
  }));
}
