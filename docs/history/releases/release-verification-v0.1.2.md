# v0.1.2 Release Verification

This document records post-release verification for the Agent Gate `v0.1.2`
GitHub prerelease.

## Release

- Release: `v0.1.2`
- Release type: GitHub prerelease
- Release URL: https://github.com/sjh9714/Agent-Gate/releases/tag/v0.1.2
- Tag target: `56ea885072349aea637866dbdc38a535f12a1ca3`
- Runtime rule behavior: unchanged from `v0.1.1`
- JSON decisions: unchanged as `pass`, `warn`, and `block`
- Markdown report UX: human-decision-first report framing

## Marketplace

- GitHub Marketplace listing: published and still accessible after `v0.1.2`
  publication
- Marketplace listed release: may still show `v0.1.1`
- Marketplace settings were not changed for `v0.1.2`
- Listing URL: https://github.com/marketplace/actions/agent-gate-for-ai-prs
- Action display name: `Agent Gate for AI PRs`
- Description: `Deterministic CI firewall for AI-generated pull requests`

## Verification

- Local verification before tagging:
  - `pnpm test`
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm build`
  - `pnpm format:check`
  - `git diff --exit-code -- packages/action/dist/index.cjs`
- GitHub release published as a prerelease.
- GitHub Marketplace listing loaded successfully after `v0.1.2` publication.
- Marketplace settings were not changed for `v0.1.2`.
- Committed Action bundle remained unchanged after build verification.

## Not Performed

- npm package publishing: not performed
- `v0.1.0` or `v0.1.1` tag rewrite/delete: not performed
- Marketplace settings changes for `v0.1.2`: not performed
- Repository settings changes: not performed
