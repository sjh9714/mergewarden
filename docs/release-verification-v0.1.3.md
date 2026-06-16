# v0.1.3 Release Verification

This document records post-release verification for Agent Gate `v0.1.3`.

## Release

- Release: `v0.1.3`
- Release type: GitHub prerelease
- Release URL: https://github.com/sjh9714/Agent-Gate/releases/tag/v0.1.3
- Tag target: `060b166f5af20d870372172851887ac673ad49e0`
- Purpose: security maintenance release for the `esbuild` Dependabot alerts
- Runtime rule behavior: unchanged from `v0.1.2`
- JSON decisions: unchanged as `pass`, `warn`, and `block`
- Markdown report UX: unchanged from `v0.1.2`

## Security Maintenance

- `esbuild` pinned to `0.28.1`
- Dependabot `esbuild` alerts #1 and #2: fixed
- `pnpm audit --audit-level low`: no known vulnerabilities
- `pnpm why esbuild`: resolved to `esbuild@0.28.1`

## Verification

- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `pnpm format:check`
- `git diff --exit-code -- packages/action/dist/index.cjs`
- GitHub CI passed
- GitHub Agent Gate passed

## External Install Smoke

- External install smoke for `sjh9714/Agent-Gate@v0.1.3` is recorded in
  `docs/external-install-smoke-v0.1.3.md`.

## Marketplace

- GitHub Marketplace listing remains accessible.
- Marketplace settings were not changed for `v0.1.3`.
- The Marketplace page may still show an earlier listed Marketplace release.

## Not Performed

- npm package publishing: not performed
- Tag rewrite/delete: not performed
- Runtime rule changes: not performed
- Workflow changes: not performed
- Repository settings changes: not performed
