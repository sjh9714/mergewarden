# v0.1.5 Release Verification

This document records post-release verification for Agent Gate `v0.1.5`.

## Release

- Release: `v0.1.5`
- Release type: GitHub prerelease
- Release URL: https://github.com/sjh9714/Agent-Gate/releases/tag/v0.1.5
- Tag target: `2b18228b32ac50186d86a76ec4a7f941a1facc6c`
- Purpose: maintenance release for compact Action log summaries
- Runtime rule behavior: unchanged from `v0.1.4`
- JSON decisions: unchanged as `pass`, `warn`, and `block`
- Markdown report UX: unchanged from `v0.1.4`
- PR comment body: unchanged from `v0.1.4`

## Action Log Summary

- Action logs now include a compact plain-text Agent Gate summary.
- The log summary includes decision, risk score, why, recommended next step,
  policy status, and compact findings.
- Evidence and remediation blocks are not printed in the compact log summary.
- Finding-derived log values are normalized and truncated before output.

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

- External install smoke for `sjh9714/Agent-Gate@v0.1.5` is recorded in
  `docs/external-install-smoke-v0.1.5.md`.
- The external smoke loaded `sjh9714/Agent-Gate@v0.1.5` without an
  `actions/checkout` step.
- The external smoke log showed the compact plain-text summary in
  `gh run --log` output.
- The external smoke log did not show a Node.js 20 deprecation warning.
- The sandbox smoke pull request remains open and unmerged.

## Marketplace

- GitHub Marketplace listing remains accessible.
- Marketplace settings were not changed for `v0.1.5`.
- The Marketplace page may still show an earlier listed Marketplace release.

## Not Performed

- npm package publishing: not performed
- Tag rewrite/delete: not performed
- Runtime rule changes: not performed
- Workflow settings changes: not performed
- Repository settings changes: not performed
