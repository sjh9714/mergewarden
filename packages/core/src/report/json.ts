import type { AnalysisResult } from "../types.js";

const DEFAULT_MAX_JSON_BYTES = 2_000_000;

export interface JsonReportOptions {
  maxBytes?: number;
}

function visibleResult(result: AnalysisResult, visibleCount: number): AnalysisResult {
  const activeCount = Math.min(result.findings.length, visibleCount);
  const waivedCount = Math.max(
    0,
    Math.min(result.waivedFindings.length, visibleCount - activeCount),
  );
  const omitted = result.findings.length + result.waivedFindings.length - activeCount - waivedCount;

  return {
    ...result,
    findings: result.findings.slice(0, activeCount),
    waivedFindings: result.waivedFindings.slice(0, waivedCount),
    metadata: {
      ...result.metadata,
      omittedFindingCount: result.metadata.omittedFindingCount + omitted,
    },
  };
}

function serialize(result: AnalysisResult): string {
  return `${JSON.stringify(result, null, 2)}\n`;
}

export function renderJsonReport(result: AnalysisResult, options: JsonReportOptions = {}): string {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_JSON_BYTES;

  if (!Number.isInteger(maxBytes) || maxBytes < 1) {
    throw new Error("JSON report maxBytes must be a positive integer.");
  }

  const full = serialize(result);
  if (Buffer.byteLength(full, "utf8") <= maxBytes) {
    return full;
  }

  const totalVisible = result.findings.length + result.waivedFindings.length;
  let low = 0;
  let high = totalVisible;
  let best: string | undefined;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const candidate = serialize(visibleResult(result, middle));

    if (Buffer.byteLength(candidate, "utf8") <= maxBytes) {
      best = candidate;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  if (best === undefined) {
    throw new Error(`JSON report metadata exceeds the ${maxBytes}-byte surface limit.`);
  }

  return best;
}
