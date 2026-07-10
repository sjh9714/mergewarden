import { createHash } from "node:crypto";

import type { EvidenceSnapshot, Finding, RawFinding } from "../types.js";

const MAX_FINDING_VALUE_LENGTH = 2_048;

function isSafePublicCharacter(codePoint: number): boolean {
  return (
    codePoint === 10 ||
    (codePoint > 31 &&
      !(codePoint >= 127 && codePoint <= 159) &&
      !(codePoint >= 0x202a && codePoint <= 0x202e) &&
      !(codePoint >= 0x2066 && codePoint <= 0x2069))
  );
}

function utf8Preview(value: string, maxBytes: number): string {
  let byteLength = 0;
  let codeUnitEnd = 0;

  for (const codePoint of value) {
    const codePointBytes = Buffer.byteLength(codePoint, "utf8");
    if (byteLength + codePointBytes > maxBytes) {
      break;
    }

    byteLength += codePointBytes;
    codeUnitEnd += codePoint.length;
  }

  return value.slice(0, codeUnitEnd);
}

function normalizeStableText(value: string): string {
  const normalized = value
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .split("")
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return isSafePublicCharacter(codePoint);
    })
    .join("");

  if (Buffer.byteLength(normalized, "utf8") <= MAX_FINDING_VALUE_LENGTH) {
    return normalized;
  }

  const digest = createHash("sha256").update(normalized).digest("hex");
  return `${utf8Preview(normalized, MAX_FINDING_VALUE_LENGTH)}… [sha256:${digest}]`;
}

function normalizeFinding(finding: RawFinding): RawFinding {
  return {
    ...finding,
    ruleId: normalizeStableText(finding.ruleId),
    title: normalizeStableText(finding.title),
    message: normalizeStableText(finding.message),
    ...(finding.path ? { path: normalizeStableText(finding.path) } : {}),
    evidence: finding.evidence.map((item) => ({
      label: normalizeStableText(item.label),
      value: normalizeStableText(item.value),
    })),
    remediation: finding.remediation.map(normalizeStableText),
    tags: finding.tags.map(normalizeStableText),
  };
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

export function createEvidenceSnapshot(finding: RawFinding): EvidenceSnapshot {
  return {
    ruleId: finding.ruleId,
    severity: finding.severity,
    ...(finding.path ? { path: normalizeStableText(finding.path) } : {}),
    ...(finding.line !== undefined ? { line: finding.line } : {}),
    evidence: sortedEvidence(finding),
  };
}

export function createFindingId(finding: RawFinding): string {
  // Severity is policy presentation, not finding identity. Keeping it out lets an exact waiver
  // survive a warn -> error policy promotion while the underlying deterministic evidence stays
  // the same.
  const snapshot = createEvidenceSnapshot(finding);
  const stableInput = {
    ruleId: snapshot.ruleId,
    ...(snapshot.path ? { path: snapshot.path } : {}),
    ...(snapshot.line !== undefined ? { line: snapshot.line } : {}),
    evidence: snapshot.evidence,
  };
  const hash = createHash("sha256").update(JSON.stringify(stableInput)).digest("hex").slice(0, 16);

  return `agf_${hash}`;
}

export function attachFindingIds(findings: RawFinding[]): Finding[] {
  return findings.map((rawFinding) => {
    const finding = normalizeFinding(rawFinding);

    return {
      ...finding,
      findingId: createFindingId(finding),
      evidenceSnapshot: createEvidenceSnapshot(finding),
      disposition: "active",
    };
  });
}
