# v0.2.4 Release Verification

This document records post-release verification for Agent Gate `v0.2.4`.

## Release

- Release: `v0.2.4`
- Release type: GitHub prerelease
- Release URL: https://github.com/sjh9714/Agent-Gate/releases/tag/v0.2.4
- Tag target: `7f8ef68791eca24df24f3884c927f39efa808608`
- Purpose: warning-mode package lifecycle script drift checks

## Runtime Change

- Added `dependency/lifecycle-script-added` for newly introduced risky package
  lifecycle scripts.
- Added `dependency/package-script-drift` for changed risky package lifecycle
  scripts.
- Added `package_scripts` config for paths, lifecycle scripts, severity, and
  disabling the rule.
- Unavailable package manifest content is surfaced as
  `analysis/content-unavailable` instead of silently skipping lifecycle drift
  analysis.
- Package/report metadata is aligned to `0.2.4`.

## Verification

- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `pnpm format:check`
- `git diff --exit-code -- pnpm-lock.yaml`
- `git diff --exit-code -- packages/action/dist/index.cjs`
- GitHub CI passed on PR #71 and PR #72.
- GitHub Agent Gate passed on PR #71 and PR #72.
- GitGuardian Security Checks passed on PR #71 and PR #72.

## External Smoke

- External install smoke for `@v0.2.4` is recorded in
  `docs/external-install-smoke-v0.2.4.md`.

## Marketplace

- GitHub Marketplace listing remains accessible.
- Marketplace settings were not changed for `v0.2.4`.

## Not Performed

- npm package publishing: not performed
- Tag rewrite/delete: not performed
- Workflow settings changes: not performed
- Repository settings changes: not performed
- Marketplace settings changes: not performed
- CODEOWNERS/reviewer evidence implementation: not performed
- Dependency addition detection: not performed
- Lockfile mismatch detection: not performed
- Maintainer override storage implementation: not performed
