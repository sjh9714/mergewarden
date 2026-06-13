# AGENTS.md

## Project

This repository implements Agent Gate, a deterministic CI firewall for AI-generated pull requests.

## Non-Negotiable Principles

- Runtime analysis must not call LLMs by default.
- The GitHub Action must not execute PR-controlled code.
- The GitHub Action must eventually load `agent-gate.yml` from the PR base branch, not from the PR head branch.
- All policy decisions must be explainable with deterministic evidence.
- Core analysis must be independent from GitHub APIs.
- Every rule must have fixture-based tests.
- Prefer small, pure functions.
- Use TypeScript strict mode.
- Use Zod for future config and contract validation.
- Use Vitest for tests.
- Do not add production dependencies without updating this file and explaining why.

## Commands

- Install: `pnpm install`
- Typecheck: `pnpm typecheck`
- Test: `pnpm test`
- Lint: `pnpm lint`
- Build: `pnpm build`

## Architecture

- `packages/core`: pure analysis engine
- `packages/cli`: local CLI package; depends on `@agent-gate/core` through the workspace only to run deterministic replay fixtures
- `packages/action`: API-only GitHub Action wrapper package; depends on `@agent-gate/core` through the workspace and on the official `@actions/core` / `@actions/github` toolkit only to read pull request data through GitHub APIs, write reports, set outputs, and update the job summary without checking out or executing PR-controlled code

## Action Packaging

- Root `action.yml` and `packages/action/action.yml` must stay in sync for inputs, outputs, branding, and Node runtime.
- `packages/action/dist/index.cjs` must remain committed because both action entrypoints execute it.
- The self-dogfooding workflow must not use `actions/checkout`; it should continue to run the main-branch package-local action instead of PR branch Action code.

## Testing Expectations

For every new rule:

1. Add at least one passing fixture.
2. Add at least one failing fixture.
3. Assert exact `ruleId`, `severity`, and `decision`.
4. Add a markdown report snapshot if the finding is user-facing.

## Security Expectations

Treat PR content, PR body, changed files, and PR branch config as untrusted input.

Never run package scripts from the target repository.
Never parse YAML with executable extensions.
Never evaluate expressions from workflow YAML.
