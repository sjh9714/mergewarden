import {
  DEFAULT_CONFIG,
  analyze,
  parseContractFromPrBody,
  renderJsonReport,
  renderMarkdownReport,
  type AnalysisInput,
  type FileChange,
} from "@mergewarden/core";

import { renderHumanReport, type CliIo } from "./replay.js";
import { MERGEWARDEN_VERSION } from "./version.js";

/**
 * A pull request that is realistic rather than maximal.
 *
 * Every finding it produces comes from the *default* policy, so `mergewarden demo` is a
 * verifiable statement about what a zero-config install does — not a showcase wired up by
 * a bespoke fixture config. Keep it that way: if a change here needs a custom policy to
 * stay interesting, the default policy is what should change instead.
 */
const DEMO_PR_BODY = `<!-- mergewarden-contract
version: 1
agent: codex
task: document the release process
allowed_paths:
  - docs/**
-->

Documents the release process and tidies a few things up along the way.
`;

const RELEASE_WORKFLOW_BASE = `name: Release
'on':
  push:
    tags: ['v*']
permissions:
  contents: read
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
`;

const RELEASE_WORKFLOW_HEAD = `name: Release
'on':
  issue_comment:
    types: [created]
permissions:
  contents: write
  id-token: write
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: \${{ secrets.ANTHROPIC_API_KEY }}
          prompt: \${{ github.event.comment.body }}
`;

const PACKAGE_JSON_BASE = `{
  "name": "demo-service",
  "scripts": {
    "test": "vitest"
  }
}
`;

const PACKAGE_JSON_HEAD = `{
  "name": "demo-service",
  "scripts": {
    "test": "vitest",
    "postinstall": "node ./scripts/setup.js"
  }
}
`;

const DEMO_FILES: FileChange[] = [
  { path: "docs/releasing.md", status: "added", additions: 48, deletions: 0 },
  {
    path: ".github/workflows/release.yml",
    status: "modified",
    additions: 9,
    deletions: 4,
    baseContent: RELEASE_WORKFLOW_BASE,
    headContent: RELEASE_WORKFLOW_HEAD,
  },
  { path: "AGENTS.md", status: "modified", additions: 6, deletions: 1 },
  {
    path: "package.json",
    status: "modified",
    additions: 1,
    deletions: 0,
    baseContent: PACKAGE_JSON_BASE,
    headContent: PACKAGE_JSON_HEAD,
  },
];

export const DEMO_NARRATION = `MergeWarden demo — a synthetic pull request, scanned with the default policy.

  Repository   demo-org/demo-service
  Pull request #482 "Document the release process"
  Author       an agent on branch codex/document-releasing
  Declared     allowed_paths: docs/**
  Changed      docs/releasing.md, .github/workflows/release.yml, AGENTS.md, package.json

No network calls and no token: this runs a fixture that ships inside the CLI. Scan a real
pull request with:  mergewarden scan <owner/repo#number>
`;

export function demoAnalysisInput(): AnalysisInput {
  return {
    repo: {
      owner: "demo-org",
      repo: "demo-service",
      defaultBranch: "main",
      baseRef: "main",
      baseSha: "9f1c1f7d5f0d4f6a8b3c2e1d0a9b8c7d6e5f4a3b",
      headRef: "codex/document-releasing",
      headSha: "3b2a1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b",
    },
    pr: {
      number: 482,
      title: "Document the release process",
      body: DEMO_PR_BODY,
      author: "demo-agent",
      labels: [],
      branchName: "codex/document-releasing",
      isFork: false,
      draft: false,
    },
    config: DEFAULT_CONFIG,
    contract: parseContractFromPrBody(DEMO_PR_BODY),
    changes: {
      files: DEMO_FILES,
      totals: {
        filesChanged: DEMO_FILES.length,
        additions: DEMO_FILES.reduce((total, file) => total + file.additions, 0),
        deletions: DEMO_FILES.reduce((total, file) => total + file.deletions, 0),
      },
    },
    reviews: [],
    checks: [],
    now: "2026-07-25T00:00:00.000Z",
    configSource: "local",
    version: MERGEWARDEN_VERSION,
  };
}

export async function runDemoCli(argv: readonly string[], io: CliIo): Promise<number> {
  let format: "human" | "json" | "markdown" = "human";

  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== "--format") {
      io.stderr(`MergeWarden CLI error: Unknown demo option: ${argv[index] ?? ""}\n`);
      return 2;
    }

    const value = argv[index + 1];
    if (value !== "human" && value !== "json" && value !== "markdown") {
      io.stderr(`MergeWarden CLI error: --format expects human, json, or markdown.\n`);
      return 2;
    }

    format = value;
    index += 1;
  }

  const result = await analyze(demoAnalysisInput());

  if (format === "human") {
    io.stdout(`${DEMO_NARRATION}\n`);
    io.stdout(renderHumanReport(result));
  } else if (format === "json") {
    io.stdout(renderJsonReport(result));
  } else {
    io.stdout(renderMarkdownReport(result));
  }

  return result.decision === "block" ? 1 : 0;
}
