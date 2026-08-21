import { describe, expect, it } from "vitest";

import { analyze } from "@mergewarden/core";

import { demoAnalysisInput, runDemoCli } from "../src/demo.js";
import { renderHumanReport } from "../src/replay.js";

function captureIo() {
  const stdout: string[] = [];
  const stderr: string[] = [];

  return {
    stdout,
    stderr,
    io: {
      stdout: (text: string) => stdout.push(text),
      stderr: (text: string) => stderr.push(text),
    },
  };
}

describe("mergewarden demo", () => {
  it("produces findings using the default policy, not a bespoke one", async () => {
    const input = demoAnalysisInput();
    const result = await analyze(input);

    // The demo's whole claim is that a zero-config install is not silent. If this ever
    // needs a custom policy to stay interesting, change the default policy instead.
    expect(input.configSource).toBe("local");
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.metadata.analysisComplete).toBe(true);
  });

  it("demonstrates one quiet instruction-file change", async () => {
    const input = demoAnalysisInput();
    const result = await analyze(input);
    const ruleIds = result.findings.map((finding) => finding.ruleId);

    expect(ruleIds).toEqual(["agent-control-plane/drift"]);
    expect(input.changes.files.map((file) => file.path)).toEqual(["CLAUDE.md"]);
  });

  it("keeps the highest-severity findings visible on the bounded terminal surface", async () => {
    const result = await analyze(demoAnalysisInput());
    const output = renderHumanReport(result);

    for (const finding of result.findings.filter((entry) => entry.severity === "error")) {
      expect(output).toContain(finding.ruleId);
    }
  });

  it("writes a report and exits 0 for a warn decision", async () => {
    const { stdout, stderr, io } = captureIo();

    await expect(runDemoCli([], io)).resolves.toBe(0);
    expect(stderr).toEqual([]);
    expect(stdout.join("")).toContain("MergeWarden demo");
    expect(stdout.join("")).toContain("agent-control-plane/drift");
  });

  it("emits machine-readable output on request", async () => {
    const { stdout, io } = captureIo();

    await expect(runDemoCli(["--format", "json"], io)).resolves.toBe(0);

    const report = JSON.parse(stdout.join("")) as { findings: { ruleId: string }[] };
    expect(report.findings.map((finding) => finding.ruleId)).toEqual(["agent-control-plane/drift"]);
  });

  it("rejects an unknown option instead of silently scanning", async () => {
    const { stderr, io } = captureIo();

    await expect(runDemoCli(["--nope"], io)).resolves.toBe(2);
    expect(stderr.join("")).toContain("Unknown demo option");
  });

  it("rejects an unsupported format", async () => {
    const { stderr, io } = captureIo();

    await expect(runDemoCli(["--format", "yaml"], io)).resolves.toBe(2);
    expect(stderr.join("")).toContain("--format expects human, json, or markdown.");
  });
});
