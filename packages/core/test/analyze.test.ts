import { describe, expect, it } from "vitest";

import { analyze } from "../src/index.js";
import { createAnalysisInput } from "./helpers.js";

describe("analyze", () => {
  it("returns a deterministic pass result when no rules are registered", async () => {
    const input = createAnalysisInput();

    const result = await analyze(input);

    expect(result).toEqual({
      decision: "pass",
      riskScore: 0,
      summary: {
        title: "Agent Gate: passed",
        agentDetected: false,
        contractPresent: false,
        errorCount: 0,
        warnCount: 0,
        infoCount: 0,
      },
      findings: [],
      metadata: {
        analyzedAt: "2026-06-13T00:00:00.000Z",
        baseSha: "base-sha",
        headSha: "head-sha",
        configSource: "local",
        version: "0.0.0",
      },
    });
  });
});
