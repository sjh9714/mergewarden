import type { MergeWardenConfig } from "../config/schema.js";
import type { Decision } from "../types.js";

interface FindingCounts {
  errorCount: number;
  warnCount: number;
}

export function decide(mode: MergeWardenConfig["mode"], counts: FindingCounts): Decision {
  if (mode === "observe") {
    return "pass";
  }

  if (mode === "warn") {
    return counts.errorCount > 0 || counts.warnCount > 0 ? "warn" : "pass";
  }

  if (counts.errorCount > 0) {
    return "block";
  }

  return counts.warnCount > 0 ? "warn" : "pass";
}
