# Agent Gate

[![Release](https://img.shields.io/github/v/release/sjh9714/Agent-Gate?include_prereleases&label=release)](https://github.com/sjh9714/Agent-Gate/releases/tag/v0.1.0)
[![CI](https://github.com/sjh9714/Agent-Gate/actions/workflows/ci.yml/badge.svg)](https://github.com/sjh9714/Agent-Gate/actions/workflows/ci.yml)
[![Agent Gate](https://github.com/sjh9714/Agent-Gate/actions/workflows/agent-gate.yml/badge.svg)](https://github.com/sjh9714/Agent-Gate/actions/workflows/agent-gate.yml)
[![License](https://img.shields.io/github/license/sjh9714/Agent-Gate)](LICENSE)

No AI PR gets merged without proof.

Agent Gate is a deterministic CI firewall for AI-generated pull requests. It checks PR contracts, risky paths, agent instruction drift, workflow permissions, and test evidence before merge.

The Action uses no checkout of PR code, no runtime LLM calls, no repository script execution, and no policy loaded from an untrusted PR head. The same analyzer also powers local replay fixtures for deterministic demos.

## Status

Agent Gate is pre-release. `v0.1.0` is available as a GitHub prerelease. The core analyzer, CLI replay, root GitHub Action, PR comments, self-dogfooding workflow, and CI are implemented. APIs and rule names may change in later releases.

For released installs, prefer `@v0.1.0` or a pinned commit SHA. `@main` tracks ongoing development.

See `docs/v0.1.0-release-notes.md` and `docs/release-verification-v0.1.0.md` for release notes and verification.

See `docs/repository-governance.md` for recommended branch protection and release safety settings.

See `docs/launch-announcement-draft.md` for a reusable launch announcement draft.

Feedback on AI-generated PR safety policies is welcome in [#27](https://github.com/sjh9714/Agent-Gate/issues/27).

## What It Catches

- Out-of-contract edits: agent PRs changing files outside their declared scope.
- Workflow permission escalation: Actions workflows gaining broader write access.
- Agent control-plane drift (`agent-control-plane/drift`): instruction or tool config changes that affect future agents.
- Missing test evidence: high-risk source changes without matching test file changes.
- MCP config drift: `.mcp.json` changes that alter which tools agents can call.

## Why

AI agents can open pull requests. Tests do not always catch:

- out-of-scope edits
- workflow permission escalation
- agent control-plane drift
- missing test evidence
- MCP config drift

## Replay Demo

Human-readable output for demos:

```bash
pnpm --filter agent-gate build
node packages/cli/dist/main.js replay fixtures/unsafe-pr-zoo/workflow-permission-escalation
```

Example output:

```text
Agent Gate: BLOCKED

ERROR workflow/permission-escalation
contents permission increased from read to write.
Path: .github/workflows/release.yml

ERROR workflow/dangerous-pattern
.github/workflows/release.yml contains a dangerous GitHub Actions workflow pattern.
Path: .github/workflows/release.yml
```

Machine-readable JSON report:

```bash
node packages/cli/dist/main.js replay fixtures/unsafe-pr-zoo/workflow-permission-escalation --format json
```

Expected result: Agent Gate reports a blocked PR with `workflow/permission-escalation` and `workflow/dangerous-pattern` findings.

Additional unsafe-pr-zoo demos:

- `agent-control-plane-drift`: blocks `AGENTS.md` changes because they can change future agent behavior.
- `out-of-scope-agent-edit`: blocks a payment webhook edit outside the PR contract's `allowed_paths`.
- `missing-test-evidence`: blocks an auth logic change without matching auth test changes.
- `mcp-config-drift`: blocks `.mcp.json` changes because MCP config can change which tools an agent can call.

```bash
node packages/cli/dist/main.js replay fixtures/unsafe-pr-zoo/agent-control-plane-drift
node packages/cli/dist/main.js replay fixtures/unsafe-pr-zoo/out-of-scope-agent-edit
node packages/cli/dist/main.js replay fixtures/unsafe-pr-zoo/missing-test-evidence
node packages/cli/dist/main.js replay fixtures/unsafe-pr-zoo/mcp-config-drift
```

## 10-Minute Observe Path

Start in warn mode, learn your repo's risk profile, then turn proven policies into merge gates.

Add a checkout-free pull request workflow:

```yaml
name: Agent Gate

on:
  pull_request:
    types: [opened, synchronize, reopened, edited, labeled, unlabeled, ready_for_review]

permissions:
  contents: read
  pull-requests: read

jobs:
  agent-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: sjh9714/Agent-Gate@v0.1.0
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          mode: warn
          fail-on-block: false
```

Start with a small `agent-gate.yml`:

```yaml
version: 1
mode: warn

contract:
  required_for:
    - agent
  allow_missing_in_observe_mode: true

agent_detection:
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

For an AI-generated PR, add a small contract to the PR body:

```md
<!-- agent-gate-contract
version: 1
agent: codex
task: update auth session handling
allowed_paths:
  - src/auth/**
  - tests/auth/**
required_evidence:
  - matching auth tests changed
-->
```

Read the first runs as observation, not proof of semantic correctness:

- `PASSED`: safe to observe
- `WARN`: needs human decision
- `BLOCKED`: must block once policy is enforced

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
      - uses: sjh9714/Agent-Gate@v0.1.0
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          mode: warn
          fail-on-block: false
```

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

## Packages

- `packages/core`: pure analysis engine, built-in deterministic rules, and JSON/Markdown report renderers.
- `packages/cli`: `agent-gate replay <fixture-dir>` for deterministic local fixture demos.
- `packages/action`: Node 20 GitHub Action package that reads pull request data through GitHub APIs and calls the core analyzer.

## Action Package

External users should prefer the root action with `sjh9714/Agent-Gate@<ref>`. The package-local action remains at `packages/action/action.yml` for this repository's own development workflow. Both use REST APIs only: they load `agent-gate.yml` from the PR base ref, read changed-file metadata and file contents from the API, run `@agent-gate/core`, write JSON/Markdown reports, set action outputs, write the job summary, and optionally upsert one marked PR report comment. They do not checkout the pull request or execute repository scripts.

## Self-Dogfooding

Agent Gate runs against this repository's pull requests through `.github/workflows/agent-gate.yml`. The workflow uses `sjh9714/Agent-Gate/packages/action@main`, so pull requests do not execute Action code from their own branches while the action itself is under development. It starts in non-blocking `warn` mode while the project tunes early policy.

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
