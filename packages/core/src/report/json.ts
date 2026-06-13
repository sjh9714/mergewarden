import type { AnalysisResult } from "../types.js";

export function renderJsonReport(result: AnalysisResult): string {
  return `${JSON.stringify(result, null, 2)}\n`;
}
