# Agent Gate

No AI PR gets merged without proof.

Agent Gate is a deterministic CI firewall for AI-generated pull requests. It is designed to block agent-authored changes when they exceed their contract, touch risky files, change agent instructions, escalate workflow permissions, or claim tests without evidence.

This repository is currently at the Task 1 scaffold stage. The TypeScript workspace and core report surface exist, but the CLI, GitHub Action, configuration parser, contract parser, and rules are not implemented yet.

## What Exists

- `packages/core`: shared types, an empty `analyze()` pass-through, and JSON/Markdown report renderers.
- `packages/cli`: reserved `agent-gate` command package with a placeholder executable.
- `packages/action`: reserved Node 20 GitHub Action package with placeholder metadata.

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
