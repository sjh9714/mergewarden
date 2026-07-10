# v0.1.6 Release Verification

This document records post-release verification for Agent Gate `v0.1.6`.

## Release

- Release: `v0.1.6`
- Release type: GitHub prerelease
- Release URL: https://github.com/sjh9714/Agent-Gate/releases/tag/v0.1.6
- Tag target: `d80621ff0e8bd3004cb489bf2dcd6590b5e0a09e`
- Purpose: trust and evidence maintenance release

## Trust And Evidence Changes

- Planned-but-unimplemented config and contract fields now fail fast instead of
  being accepted as no-op settings.
- Report metadata now uses the current Agent Gate version instead of `0.0.0`.
- Unavailable GitHub Actions workflow content is surfaced as
  `analysis/content-unavailable` instead of being silently skipped.
- JSON decisions remain unchanged as `pass`, `warn`, and `block`.
- Markdown report format, PR comment format, and compact log summary format are
  unchanged from `v0.1.5`.

## Version Metadata

- Root package version: `0.1.6`
- Core package version: `0.1.6`
- Action package version: `0.1.6`
- CLI package version: `0.1.6`
- `AGENT_GATE_VERSION`: `0.1.6`
- The committed Action bundle includes `AGENT_GATE_VERSION = "0.1.6"`.

## Verification

- `pnpm build`
- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm format:check`
- `git diff --exit-code -- pnpm-lock.yaml`
- `git diff --exit-code -- packages/action/dist/index.cjs`
- GitHub CI passed on the landed PRs
- GitHub Agent Gate passed after the base policy was aligned with the schema

## Marketplace

- GitHub Marketplace listing remains accessible.
- Marketplace settings were not changed for `v0.1.6`.
- The Marketplace page may still show an earlier listed Marketplace release.

## External Smoke

- A new external install smoke was not performed for `v0.1.6`.
- The latest recorded external install smoke remains `v0.1.5` in
  `docs/history/smoke/external-install-smoke-v0.1.5.md`.

## Not Performed

- npm package publishing: not performed
- Tag rewrite/delete: not performed
- Workflow settings changes: not performed
- Repository settings changes: not performed
- Marketplace settings changes: not performed
