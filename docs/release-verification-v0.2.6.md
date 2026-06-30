# v0.2.6 Release Verification

This document records post-release verification for Agent Gate `v0.2.6`.

## Release

- Release: `v0.2.6`
- Release type: GitHub prerelease
- Release URL: https://github.com/sjh9714/Agent-Gate/releases/tag/v0.2.6
- Tag target: `75b52b1b02f33ff53117f459fded7312a4a34bfe`
- Published at: `2026-06-30T11:09:15Z`
- Purpose: richer workflow permission escalation evidence

## Runtime Change

- Added workflow/job scope context to `workflow/permission-escalation`
  findings.
- Detects job-level permission escalation, including restrictive job permission
  removal that exposes broader workflow permissions.
- Records stable `affected_capability` evidence for escalated permissions.
- Keeps human-readable affected-area prose in report messages.
- Keeps the existing `workflow/permission-escalation` rule ID.
- Package/report metadata is aligned to `0.2.6`.

## Verification

- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `pnpm format:check`
- `git diff --exit-code -- pnpm-lock.yaml`
- `git diff --exit-code -- packages/action/dist/index.cjs`
- GitHub CI passed on PR #85 and PR #86.
- GitHub Agent Gate passed on PR #85 and PR #86.
- GitGuardian Security Checks passed on PR #85 and PR #86.
- Dependabot open alerts: `0`

## External Smoke

- External install smoke for `@v0.2.6` is recorded in
  `docs/external-install-smoke-v0.2.6.md`.
- The smoke pull request remains open and unmerged as external proof evidence.

## Marketplace

- GitHub Marketplace listing remains accessible.
- Marketplace settings were not changed for `v0.2.6`.

## Not Performed

- npm package publishing: not performed
- Stable release conversion: not performed
- Tag rewrite/delete: not performed
- Workflow settings changes: not performed
- Repository settings changes: not performed
- Marketplace settings changes: not performed
- CODEOWNERS/reviewer evidence implementation: not performed
- Permission necessity auto-detection: not performed
- History replay/audit mode implementation: not performed
