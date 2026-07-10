# v0.1.4 Release Verification

This document records post-release verification for Agent Gate `v0.1.4`.

## Release

- Release: `v0.1.4`
- Release type: GitHub prerelease
- Release URL: https://github.com/sjh9714/Agent-Gate/releases/tag/v0.1.4
- Tag target: `1f7d139cc020c794a26231a24b5d0431d9bc8154`
- Purpose: maintenance release for the Node 24 GitHub Action runtime migration
- Runtime rule behavior: unchanged from `v0.1.3`
- JSON decisions: unchanged as `pass`, `warn`, and `block`
- Markdown report UX: unchanged from `v0.1.3`

## Runtime Maintenance

- Root `action.yml`: `runs.using` is `node24`
- `packages/action/action.yml`: `runs.using` is `node24`
- Action build target: `node24`
- CI committed bundle smoke test: Node 24

## Verification

- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `pnpm format:check`
- `git diff --exit-code -- packages/action/dist/index.cjs`
- `git diff --exit-code -- pnpm-lock.yaml`
- GitHub CI passed
- GitHub Agent Gate passed

## External Install Smoke

- External install smoke for `sjh9714/Agent-Gate@v0.1.4` is recorded in
  `docs/history/smoke/external-install-smoke-v0.1.4.md`.
- The external smoke loaded `sjh9714/Agent-Gate@v0.1.4` without an
  `actions/checkout` step.
- The external smoke log did not show the previous Node.js 20 deprecation
  warning.
- The sandbox smoke pull request remains open and unmerged.

## Marketplace

- GitHub Marketplace listing remains accessible.
- Marketplace settings were not changed for `v0.1.4`.
- The Marketplace page may still show an earlier listed Marketplace release.

## Not Performed

- npm package publishing: not performed
- Tag rewrite/delete: not performed
- Runtime rule changes: not performed
- Workflow settings changes: not performed
- Repository settings changes: not performed
