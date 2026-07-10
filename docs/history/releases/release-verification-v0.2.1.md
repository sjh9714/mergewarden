# v0.2.1 Release Verification

This document records post-release verification for Agent Gate `v0.2.1`.

## Release

- Release: `v0.2.1`
- Release type: GitHub prerelease
- Release URL: https://github.com/sjh9714/Agent-Gate/releases/tag/v0.2.1
- Tag target: `9db285b5fde378539631e02dd32df5d4c7e13485`
- Purpose: evidence snapshot report schema maintenance

## Evidence Model Changes

- Public findings now include `evidenceSnapshot`, the canonical material used to derive `findingId`.
- JSON reports include `findings[].evidenceSnapshot`.
- Markdown reports include an `Evidence Snapshot` block in detailed findings.
- Compact plain-text Action logs remain concise and continue to show finding IDs.
- `docs/evidence-model.md` and `docs/evidence-snapshot-example.md` document evidence snapshots and re-derivation examples.
- JSON decisions remain unchanged as `pass`, `warn`, and `block`.
- Runtime rule behavior and scoring are unchanged from `v0.2.0`.

## Verification

- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `pnpm format:check`
- `git diff --exit-code -- pnpm-lock.yaml`
- `git diff --exit-code -- packages/action/dist/index.cjs`
- GitHub CI passed on PR #62.
- GitHub Agent Gate passed on PR #62.
- GitGuardian Security Checks passed on PR #62.

## External Smoke

- External install smoke for `@v0.2.1` is recorded in `docs/history/smoke/external-install-smoke-v0.2.1.md`.
- The smoke verified external loading, warning-mode behavior, compact log finding IDs, Markdown `Evidence Snapshot` output, and JSON `findings[].evidenceSnapshot` output.

## Marketplace

- GitHub Marketplace listing remains accessible.
- Marketplace settings were not changed for `v0.2.1`.

## Not Performed

- npm package publishing: not performed
- Tag rewrite/delete: not performed
- Workflow settings changes: not performed
- Repository settings changes: not performed
- Marketplace settings changes: not performed
- CODEOWNERS/reviewer evidence implementation: not performed
- Package/dependency drift implementation: not performed
- Maintainer override storage implementation: not performed
