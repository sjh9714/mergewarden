import { describe, expect, it } from "vitest";

import { analyze, parseConfig } from "../../src/index.js";
import { createAnalysisInput } from "../helpers.js";

const WORKFLOW_PATH = ".github/workflows/ci.yml";

function workflowFile(baseContent: string | null, headContent: string, status = "modified") {
  return [
    {
      path: WORKFLOW_PATH,
      status: status as "modified" | "added" | "removed" | "renamed",
      additions: 1,
      deletions: 1,
      baseContent,
      headContent,
    },
  ];
}

const BOTH_TRIGGERS = `name: CI
on:
  pull_request:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: npm test
`;

const PUSH_ONLY = `name: CI
on:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: npm test
`;

async function run(base: string | null, head: string, config?: string) {
  return analyze(
    createAnalysisInput({
      ...(config ? { config: parseConfig(config) } : {}),
      files: workflowFile(base, head),
    }),
  );
}

describe("workflow/trigger-removed", () => {
  it("reports a workflow that stops running on pull requests", async () => {
    const result = await run(BOTH_TRIGGERS, PUSH_ONLY);

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "workflow/trigger-removed",
        severity: "warn",
        path: WORKFLOW_PATH,
        evidence: expect.arrayContaining([
          { label: "removed_event", value: "pull_request" },
          { label: "events_before", value: "pull_request, push" },
          { label: "events_after", value: "push" },
        ]),
      }),
    );
  });

  it("names the consequence a reviewer actually cares about", async () => {
    const result = await run(BOTH_TRIGGERS, PUSH_ONLY);
    const finding = result.findings.find((f) => f.ruleId === "workflow/trigger-removed");

    expect(finding?.message).toContain("including the one removing it");
  });

  it("stays silent when triggers are unchanged", async () => {
    const result = await run(BOTH_TRIGGERS, BOTH_TRIGGERS.replace("npm test", "npm run test"));

    expect(result.findings.map((f) => f.ruleId)).not.toContain("workflow/trigger-removed");
  });

  it("stays silent when a trigger is added", async () => {
    const result = await run(PUSH_ONLY, BOTH_TRIGGERS);

    expect(result.findings.map((f) => f.ruleId)).not.toContain("workflow/trigger-removed");
  });

  it("stays silent for a newly added workflow, which had no triggers to lose", async () => {
    const result = await analyze(
      createAnalysisInput({ files: workflowFile(null, PUSH_ONLY, "added") }),
    );

    expect(result.findings.map((f) => f.ruleId)).not.toContain("workflow/trigger-removed");
  });

  it("leaves a deleted workflow to the workflow_deleted check", async () => {
    const result = await analyze(
      createAnalysisInput({ files: workflowFile(BOTH_TRIGGERS, "", "removed") }),
    );

    expect(result.findings.map((f) => f.ruleId)).not.toContain("workflow/trigger-removed");
  });

  it("reads the sequence form of on:", async () => {
    const base = "name: CI\non: [pull_request, push]\njobs: {}\n";
    const head = "name: CI\non: [push]\njobs: {}\n";
    const result = await run(base, head);

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "workflow/trigger-removed",
        evidence: expect.arrayContaining([{ label: "removed_event", value: "pull_request" }]),
      }),
    );
  });

  it("reads the bare string form of on:", async () => {
    const result = await run(
      "name: CI\non: pull_request\njobs: {}\n",
      "name: CI\non: push\njobs: {}\n",
    );

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "workflow/trigger-removed",
        evidence: expect.arrayContaining([{ label: "removed_event", value: "pull_request" }]),
      }),
    );
  });

  it("does not guess at triggers when the base workflow will not parse", async () => {
    const result = await run("name: CI\non:\n  - [unbalanced\n", PUSH_ONLY);

    expect(result.findings.map((f) => f.ruleId)).not.toContain("workflow/trigger-removed");
  });

  it("can be switched off", async () => {
    const result = await run(
      BOTH_TRIGGERS,
      PUSH_ONLY,
      "version: 1\ngithub_actions:\n  checks:\n    trigger_removed: off\n",
    );

    expect(result.findings.map((f) => f.ruleId)).not.toContain("workflow/trigger-removed");
  });

  it("blocks when a repository opts in to error severity", async () => {
    const result = await run(
      BOTH_TRIGGERS,
      PUSH_ONLY,
      "version: 1\nmode: block\ngithub_actions:\n  checks:\n    trigger_removed: error\n",
    );

    expect(result.decision).toBe("block");
  });
});
