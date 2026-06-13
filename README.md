# Agent Gate

No AI PR gets merged without proof.

Agent Gate is a deterministic CI firewall for AI-generated pull requests. It is designed to block agent-authored changes when they exceed their contract, touch risky files, change agent instructions, escalate workflow permissions, or claim tests without evidence.

This repository is in early development. The core package now includes deterministic config parsing, PR-body contract parsing, path/risk/control-plane/test-evidence rules, and GitHub Actions workflow safety rules. The CLI can replay local fixtures so the engine can be demonstrated without calling GitHub APIs or executing PR-controlled code.

## What Exists

- `packages/core`: pure analysis engine, built-in deterministic rules, and JSON/Markdown report renderers.
- `packages/cli`: `agent-gate replay <fixture-dir>` for deterministic local fixture demos.
- `packages/action`: reserved Node 20 GitHub Action package with placeholder metadata.

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
