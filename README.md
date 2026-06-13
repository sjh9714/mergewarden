# Agent Gate

No AI PR gets merged without proof.

Agent Gate is a deterministic CI firewall for AI-generated pull requests. It is designed to block agent-authored changes when they exceed their contract, touch risky files, change agent instructions, escalate workflow permissions, or claim tests without evidence.

This repository is in early development. The core package now includes deterministic config parsing, PR-body contract parsing, path/risk/control-plane/test-evidence rules, and GitHub Actions workflow safety rules. The CLI can replay local fixtures so the engine can be demonstrated without calling GitHub APIs or executing PR-controlled code.

## What Exists

- `packages/core`: pure analysis engine, built-in deterministic rules, and JSON/Markdown report renderers.
- `packages/cli`: `agent-gate replay <fixture-dir>` for deterministic local fixture demos.
- `packages/action`: development Node 20 GitHub Action package that reads pull request data through GitHub APIs and calls the core analyzer.

## Install

Add Agent Gate to a repository with a pull request workflow. No checkout step is required.

```yaml
name: Agent Gate

on:
  pull_request:
    types:
      - opened
      - synchronize
      - reopened
      - edited
      - labeled
      - unlabeled
      - ready_for_review

permissions:
  contents: read
  pull-requests: read

jobs:
  agent-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: sjh9714/Agent-Gate@main
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          mode: warn
          fail-on-block: false
```

Use `@main` while Agent Gate is pre-release. After the first release, prefer a version tag such as `@v0` or a pinned commit SHA.

Agent Gate loads policy from the PR base branch and does not execute PR branch code. Start with `mode: warn` and `fail-on-block: false`, tune the findings, then move to `mode: block` when ready.

To let Agent Gate create or update a PR report comment, add `issues: write` to the workflow permissions and set `comment: true`. Keep `contents: read` and `pull-requests: read`; no checkout step is needed. On fork pull requests, GitHub may still provide a read-only token, so comment failures are reported as warnings instead of failing the action.

```yaml
permissions:
  contents: read
  pull-requests: read
  issues: write

with:
  comment: true
```

Create `agent-gate.yml` in the repository root:

```yaml
version: 1
mode: warn

contract:
  required_for:
    - agent
  allow_missing_in_observe_mode: true

agent_detection:
  authors:
    - github-copilot[bot]
  labels:
    - ai
    - agent
    - codex
  branch_patterns:
    - "codex/**"
    - "ai/**"

high_risk_paths:
  workflows:
    paths:
      - ".github/workflows/**"
    severity: error
```

Teams can add auth, payments, infra, and agent-control-plane paths as their policy matures.

## Replay Demo

Human-readable output for demos:

```bash
pnpm --filter agent-gate build
node packages/cli/dist/main.js replay fixtures/unsafe-pr-zoo/workflow-permission-escalation
```

Machine-readable JSON report:

```bash
node packages/cli/dist/main.js replay fixtures/unsafe-pr-zoo/workflow-permission-escalation --format json
```

Expected result: Agent Gate reports a blocked PR with `workflow/permission-escalation` and `workflow/dangerous-pattern` findings.

## Action Package

External users should prefer the root action with `sjh9714/Agent-Gate@<ref>`. The package-local action remains at `packages/action/action.yml` for this repository's own development workflow. Both use REST APIs only: they load `agent-gate.yml` from the PR base ref, read changed-file metadata and file contents from the API, run `@agent-gate/core`, write JSON/Markdown reports, set action outputs, write the job summary, and optionally upsert one marked PR report comment. They do not checkout the pull request or execute repository scripts.

## Self-Dogfooding

Agent Gate runs against this repository's pull requests through `.github/workflows/agent-gate.yml`. The workflow uses `sjh9714/Agent-Gate/packages/action@main`, so pull requests do not execute Action code from their own branches while the action itself is under development. It starts in non-blocking `warn` mode while the project tunes early policy.

PR #8 switched the packaged Action runtime to CommonJS so the main-branch Action can load on GitHub runners.

## Commands

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

## Principle

Agent Gate must not call LLMs at runtime, execute PR-controlled code, or load policy from an untrusted PR head. The core analysis package must remain independent from GitHub APIs.
