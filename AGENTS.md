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

- `packages/core`: pure analysis engine with no GitHub API dependency
- `packages/github`: private API-only pull-request collection package; depends on `@agent-gate/core` through the workspace and exposes transport ports used by the Action and CLI. It adds no third-party production dependency.
- `packages/cli`: public `agent-gate` CLI; uses the private core and GitHub packages at build time, then bundles every runtime dependency into the published executable so npm metadata has no private or `workspace:*` runtime dependency
- `packages/action`: API-only GitHub Action wrapper package; depends on the private core and GitHub packages through the workspace and on the official `@actions/core` / `@actions/github` toolkit only to read pull request data through GitHub APIs, write bounded reports, set outputs, update the job summary, and optionally upsert a marked PR report comment without checking out or executing PR-controlled code

## Action Packaging

- Root `action.yml` and `packages/action/action.yml` must stay in sync for inputs, outputs, branding, and Node runtime.
- `packages/action/dist/index.cjs` must remain committed because both action entrypoints execute it.
- The self-dogfooding workflow must not use `actions/checkout`; it should continue to run the main-branch package-local action instead of PR branch Action code.
- `.github/workflows/ci.yml` is ordinary repository CI and may checkout this repo and run package scripts; `.github/workflows/agent-gate.yml` must remain API-only and checkout-free.
- CI uses Node 22 for pnpm, but the committed Action bundle should be smoke-tested on Node 24 because `action.yml` declares a Node 24 runtime.

## Release Guidance

- Update `CHANGELOG.md` for user-visible changes.
- Keep `docs/release-checklist.md` current as packaging and release steps evolve.
- Do not create tags or GitHub releases from Codex unless explicitly requested.
- Do not publish packages unless explicitly requested.

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
