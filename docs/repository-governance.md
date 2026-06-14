# Repository Governance

This document describes recommended repository settings for Agent Gate before a
`v0.1.0` pre-release. It is guidance only: do not apply repository settings from
code unless the user explicitly requests a GitHub settings task.

## Main Branch Protection

Recommended `main` branch protection:

- Require a pull request before merging.
- Require status checks before merging.
- Block force pushes.
- Block branch deletion.
- Optionally require branches to be up to date before merging.
- Optionally require conversation resolution before merging.

## Required Checks

Recommended required checks:

- `CI`
- `Agent Gate`

Before the `v0.1.0` pre-release, `main` branch protection was reviewed and
applied with required checks for `CI` and `Agent Gate`.

Agent Gate currently runs in non-blocking `warn` mode while policy is tuned. If
Agent Gate becomes a required check during this phase, keep
`fail-on-block: false` so the check surfaces findings without blocking merges.
Move to `mode: block` and `fail-on-block: true` only after false positives are
understood.

## Merge Strategy

- Prefer squash merge.
- Delete merged branches.
- Avoid direct pushes to `main`.
- Keep feature branches small enough that Agent Gate findings are easy to
  review.

## Release Safety

- Create tags and GitHub releases only when intentionally cutting a release.
- Update `CHANGELOG.md` before tagging.
- Use `docs/release-checklist.md` for pre-release verification.
- Do not publish packages unless the release task explicitly includes
  publishing.

## Self-Dogfooding Policy

- `.github/workflows/agent-gate.yml` must remain checkout-free and API-only.
- `.github/workflows/ci.yml` may checkout this repository and run package
  scripts because it is ordinary repository CI.
- Root `action.yml` and `packages/action/action.yml` must stay in sync.
- `packages/action/dist/index.cjs` must remain committed and fresh.

## Recommended Manual Setup

Apply branch protection through the GitHub UI, or through an explicit future
`gh api` task with the desired repository settings reviewed first. This docs PR
does not change repository settings.
