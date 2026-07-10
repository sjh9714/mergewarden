# v0.2.0 Release Verification

This document records post-release verification for Agent Gate `v0.2.0`.

## Release

- Release: `v0.2.0`
- Release type: GitHub prerelease
- Release URL: https://github.com/sjh9714/Agent-Gate/releases/tag/v0.2.0
- Tag target: `7ee63b4cf5aa82ccf30b3669e180c58d3efc852b`
- Purpose: v0.2 evidence model foundation

## Evidence Model Changes

- Public findings now include stable `findingId` values.
- JSON reports include `findings[].findingId`.
- Markdown reports include `Finding ID` entries in detailed findings.
- Compact plain-text Action logs include finding IDs in finding lines.
- `docs/evidence-model.md` documents re-derivable findings, warn-mode signal
  measurement, test-evidence limits, agent-control-plane drift boundaries, and
  future override audit concerns.
- JSON decisions remain unchanged as `pass`, `warn`, and `block`.
- Runtime rule behavior and scoring are otherwise unchanged from `v0.1.6`.

## Version Metadata

- Root package version: `0.2.0`
- Core package version: `0.2.0`
- Action package version: `0.2.0`
- CLI package version: `0.2.0`
- `AGENT_GATE_VERSION`: `0.2.0`
- The committed Action bundle includes `AGENT_GATE_VERSION = "0.2.0"`.
- Version consistency is guarded by tests.

## Verification

- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `pnpm format:check`
- `git diff --exit-code -- pnpm-lock.yaml`
- `git diff --exit-code -- packages/action/dist/index.cjs`
- GitHub CI passed on the release candidate PR.
- GitHub Agent Gate passed on the release candidate PR.
- GitGuardian Security Checks passed on the release candidate PR.

## External Smoke

- External install smoke for `@v0.2.0` is recorded in
  `docs/history/smoke/external-install-smoke-v0.2.0.md`.
- The smoke verified external loading, warning-mode behavior, compact log
  finding IDs, Markdown `Finding ID` output, and JSON `findings[].findingId`
  output.

## Marketplace

- GitHub Marketplace listing remains accessible.
- Marketplace settings were not changed for `v0.2.0`.
- The Marketplace page may still show an earlier listed Marketplace release.

## Not Performed

- npm package publishing: not performed
- Tag rewrite/delete: not performed
- Workflow settings changes: not performed
- Repository settings changes: not performed
- Marketplace settings changes: not performed
- CODEOWNERS/reviewer evidence implementation: not performed
- Package/dependency drift implementation: not performed
- Maintainer override storage implementation: not performed
