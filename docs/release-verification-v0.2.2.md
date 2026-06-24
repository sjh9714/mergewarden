# v0.2.2 Release Verification

This document records post-release verification for Agent Gate `v0.2.2`.

## Release

- Release: `v0.2.2`
- Release type: GitHub prerelease
- Release URL: https://github.com/sjh9714/Agent-Gate/releases/tag/v0.2.2
- Tag target: `35a4d3165a85e732f6f5c93708f023a3af757bec`
- Purpose: security maintenance for the committed Action runtime bundle

## Security Maintenance

- The transitive `undici` runtime dependency resolves to `6.27.0`.
- The committed Action bundle was rebuilt with `undici@6.27.0`.
- Package versions and Agent Gate report metadata were aligned to `0.2.2`.
- Runtime rule behavior and JSON decisions are unchanged from `v0.2.1`.

## Verification

- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `pnpm format:check`
- `pnpm why undici --recursive`
- `rg -n 'undici@6\.26\.0|undici: 6\.26\.0' pnpm-lock.yaml packages/action/dist/index.cjs || true`
- GitHub CI passed on PR #65.
- GitHub Agent Gate passed on PR #65.
- GitGuardian Security Checks passed on PR #65.
- Dependabot open alerts returned `0` after the `v0.2.2` release.

## External Smoke

- No new external install smoke was performed for `v0.2.2`.
- The latest external install smoke evidence remains `@v0.2.1` in `docs/external-install-smoke-v0.2.1.md`.

## Marketplace

- GitHub Marketplace listing remains accessible.
- Marketplace settings were not changed for `v0.2.2`.

## Not Performed

- npm package publishing: not performed
- Tag rewrite/delete: not performed
- Workflow settings changes: not performed
- Repository settings changes: not performed
- Marketplace settings changes: not performed
- CODEOWNERS/reviewer evidence implementation: not performed
- Package/dependency drift implementation: not performed
- Maintainer override storage implementation: not performed
