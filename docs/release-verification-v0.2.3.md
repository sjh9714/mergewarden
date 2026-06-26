# v0.2.3 Release Verification

This document records post-release verification for Agent Gate `v0.2.3`.

## Release

- Release: `v0.2.3`
- Release type: GitHub prerelease
- Release URL: https://github.com/sjh9714/Agent-Gate/releases/tag/v0.2.3
- Tag target: `145a7fbff4589ecacf436c1a92e673361227ccb8`
- Purpose: zero-config observe-mode onboarding with fail-closed policy loading

## Runtime Change

- Missing default `agent-gate.yml` on the PR base branch can fall back to the
  built-in default policy.
- Missing explicit custom config paths fail fast.
- Policy API errors, malformed content responses, and invalid config still fail
  fast.
- Reports record default fallback as `configSource: default`.
- Markdown reports and job summaries show the human-readable policy source.

## Verification

- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `pnpm format:check`
- `git diff --exit-code -- pnpm-lock.yaml`
- `git diff --exit-code -- packages/action/dist/index.cjs`
- GitHub CI passed on PR #68 and PR #69.
- GitHub Agent Gate passed on PR #68 and PR #69.
- GitGuardian Security Checks passed on PR #68 and PR #69.
- External pre-ready smoke for PR #68 verified default fallback, custom config
  fail-fast, and invalid config fail-fast.

## External Smoke

- External install smoke for `@v0.2.3` is recorded in
  `docs/external-install-smoke-v0.2.3.md`.

## Marketplace

- GitHub Marketplace listing remains accessible.
- Marketplace settings were not changed for `v0.2.3`.

## Not Performed

- npm package publishing: not performed
- Tag rewrite/delete: not performed
- Workflow settings changes: not performed
- Repository settings changes: not performed
- Marketplace settings changes: not performed
- CODEOWNERS/reviewer evidence implementation: not performed
- Package/dependency drift implementation: not performed
- Maintainer override storage implementation: not performed
