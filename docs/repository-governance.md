# Repository Governance

These are recommended settings. Changes to GitHub repository settings require
an explicit maintainer action outside the codebase.

## Main Protection

- Require a pull request before merging.
- Require `CI` and `MergeWarden` checks.
- Block force pushes and branch deletion.
- Require conversation resolution when practical.
- Prefer squash merge and delete merged branches.

Keep MergeWarden non-blocking during tuning. Move to `mode: block` and
`fail-on-block: true` only after representative warn-mode results are reviewed.

## Release Governance

- Follow [the release checklist](release-checklist.md).
- Use a signed annotated version tag and never move or delete it.
- Do not create mutable major tags such as `v0`.
- Publish the exact tested npm tarball with provenance.
- Publish a normal GitHub release only after `npx` verification succeeds.
- Keep Action install guidance aligned with the normal release and Marketplace.
- Enable immutable releases when the repository setting is available.

## Self-Dogfooding

- `.github/workflows/mergewarden.yml` remains checkout-free and API-only.
- `.github/workflows/ci.yml` may checkout and run this repository's scripts.
- Root and package-local Action metadata remain structurally identical.
- The committed Node 24 Action bundle must be fresh.
