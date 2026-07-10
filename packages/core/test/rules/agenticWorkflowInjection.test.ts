import { describe, expect, it } from "vitest";

import { analyze, parseConfig, type FileChange } from "../../src/index.js";
import { createAnalysisInput } from "../helpers.js";

const PINNED_SHA = "0123456789abcdef0123456789abcdef01234567";

function workflowChange(
  headContent: string,
  baseContent = "permissions: read-all\njobs: {}\n",
): FileChange {
  return {
    path: ".github/workflows/agent.yml",
    status: "modified",
    additions: 1,
    deletions: 0,
    baseContent,
    headContent,
  };
}

describe("workflow/agentic-untrusted-input", () => {
  it("warns for direct untrusted prompt input in an explicit read-only workflow", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        files: [
          workflowChange(`
permissions: read-all
jobs:
  review:
    steps:
      - uses: openai/codex-action@${PINNED_SHA}
        with:
          prompt: \${{ github['event']['pull_request'] [ 'body' ] }}
`),
        ],
      }),
    );

    expect(result.decision).toBe("warn");
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "workflow/agentic-untrusted-input",
        severity: "warn",
        evidence: expect.arrayContaining([
          { label: "source_expression", value: "github.event.pull_request.body" },
          { label: "sink_action", value: "openai/codex-action" },
          { label: "sink_input", value: "prompt" },
          { label: "job", value: "review" },
          { label: "effective_capability", value: "read-only" },
        ]),
      }),
    );
  });

  it("uses privileged severity when token permissions are unknown", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        files: [
          workflowChange(`
jobs:
  review:
    steps:
      - uses: anthropics/claude-code-action@${PINNED_SHA}
        with:
          prompt: \${{ github.event.issue.title }}
`),
        ],
      }),
    );

    expect(result.decision).toBe("block");
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "workflow/agentic-untrusted-input",
        severity: "error",
        evidence: expect.arrayContaining([{ label: "effective_capability", value: "unknown" }]),
      }),
    );
  });

  it("treats unknown write permission keys as privileged instead of read-only", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        files: [
          workflowChange(`
permissions:
  future-capability: write
jobs:
  review:
    steps:
      - uses: openai/codex-action@${PINNED_SHA}
        with:
          prompt: \${{ github.event.issue.body }}
`),
        ],
      }),
    );

    expect(result.decision).toBe("block");
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "workflow/agentic-untrusted-input",
        severity: "error",
        evidence: expect.arrayContaining([{ label: "effective_capability", value: "unknown" }]),
      }),
    );
  });

  it("traces one workflow/job/step env hop into a registered prompt", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        files: [
          workflowChange(`
permissions: read-all
env:
  USER_PROMPT: \${{ github.event.comment.body }}
jobs:
  review:
    steps:
      - uses: google-github-actions/run-gemini-cli@${PINNED_SHA}
        with:
          prompt: \${{ env.USER_PROMPT }}
`),
        ],
      }),
    );

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "workflow/agentic-untrusted-input",
        severity: "warn",
        evidence: expect.arrayContaining([
          {
            label: "source_expression",
            value: "github.event.comment.body via env.USER_PROMPT",
          },
        ]),
      }),
    );
  });

  it("uses privileged severity when the same agent step receives a secret", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        files: [
          workflowChange(`
permissions: read-all
env:
  API_KEY: \${{ secrets [ 'AGENT_KEY' ] }}
jobs:
  review:
    steps:
      - uses: openai/codex-action@${PINNED_SHA}
        with:
          prompt: \${{ github.event.review.body }}
`),
        ],
      }),
    );

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "workflow/agentic-untrusted-input",
        severity: "error",
        evidence: expect.arrayContaining([{ label: "effective_capability", value: "secret" }]),
      }),
    );
  });

  it("supports explicit custom action registries", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig(`
version: 1
mode: block
agentic_workflows:
  additional_actions:
    - uses: owner/custom-agent-action
      prompt_inputs: [instructions]
`),
        files: [
          workflowChange(`
permissions: read-all
jobs:
  review:
    steps:
      - uses: owner/custom-agent-action@${PINNED_SHA}
        with:
          instructions: \${{ github.event.discussion.body }}
`),
        ],
      }),
    );

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        ruleId: "workflow/agentic-untrusted-input",
        severity: "warn",
        evidence: expect.arrayContaining([
          { label: "sink_action", value: "owner/custom-agent-action" },
          { label: "sink_input", value: "instructions" },
        ]),
      }),
    );
  });

  it("does not emit for fixed prompts, unregistered actions, or unchanged exposure", async () => {
    const safeWorkflow = `
permissions: read-all
jobs:
  review:
    steps:
      - uses: owner/not-registered@${PINNED_SHA}
        with:
          prompt: \${{ github.event.issue.body }}
      - uses: openai/codex-action@${PINNED_SHA}
        with:
          prompt: Review this repository using the checked-in instructions.
`;
    const unchangedExposure = `
permissions: read-all
jobs:
  review:
    steps:
      - uses: openai/codex-action@${PINNED_SHA}
        with:
          prompt: \${{ github.event.issue.body }}
`;
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig("version: 1\nmode: block\n"),
        files: [
          workflowChange(safeWorkflow),
          {
            ...workflowChange(unchangedExposure, unchangedExposure),
            path: ".github/workflows/unchanged.yml",
          },
        ],
      }),
    );

    expect(result.findings.map((finding) => finding.ruleId)).not.toContain(
      "workflow/agentic-untrusted-input",
    );
  });

  it("can be disabled deterministically", async () => {
    const result = await analyze(
      createAnalysisInput({
        config: parseConfig(`
version: 1
agentic_workflows:
  enabled: false
`),
        files: [
          workflowChange(`
jobs:
  review:
    steps:
      - uses: openai/codex-action@${PINNED_SHA}
        with:
          prompt: \${{ github.event.issue.body }}
`),
        ],
      }),
    );

    expect(result.findings.map((finding) => finding.ruleId)).not.toContain(
      "workflow/agentic-untrusted-input",
    );
  });
});
