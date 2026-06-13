# Agent Gate

No AI PR gets merged without proof.

Agent Gate is a deterministic CI firewall for AI-generated pull requests. It is designed to block agent-authored changes when they exceed their contract, touch risky files, change agent instructions, escalate workflow permissions, or claim tests without evidence.

This repository is in early development. The core package now includes deterministic config parsing, PR-body contract parsing, path/risk/control-plane/test-evidence rules, and GitHub Actions workflow safety rules. The CLI can replay local fixtures so the engine can be demonstrated without calling GitHub APIs or executing PR-controlled code.

## What Exists

- `packages/core`: pure analysis engine, built-in deterministic rules, and JSON/Markdown report renderers.
- `packages/cli`: `agent-gate replay <fixture-dir>` for deterministic local fixture demos.
- `packages/action`: development Node 20 GitHub Action package that reads pull request data through GitHub APIs and calls the core analyzer. It remains package-local for now; a root `action.yml` or marketplace release layout is intentionally deferred.

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

The GitHub Action wrapper currently lives at `packages/action/action.yml` for development. It uses REST APIs only: it loads `agent-gate.yml` from the PR base ref, reads changed-file metadata and file contents from the API, runs `@agent-gate/core`, writes JSON/Markdown reports, sets action outputs, and writes the job summary. It does not checkout the pull request or execute repository scripts.

PR comments are not implemented yet. When `comment: true` is set, the action emits a notice instead of calling comment APIs.

## Self-Dogfooding

Agent Gate runs against this repository's pull requests through `.github/workflows/agent-gate.yml`. The workflow uses `sjh9714/Agent-Gate/packages/action@main`, so pull requests do not execute Action code from their own branches. It starts in non-blocking `warn` mode while the project tunes early policy.

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
