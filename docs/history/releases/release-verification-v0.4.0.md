# MergeWarden v0.4.0 Release Verification

Verified on 2026-07-21. First release under the MergeWarden name and the
unscoped `mergewarden` npm package.

## Release identity

- Release: https://github.com/sjh9714/mergewarden/releases/tag/v0.4.0
- Signed annotated tag object: `5556d9b3265294d698eeffd51d147a2944ad086f`
- Release commit: `21982fe53cec6d465777bc853de097da8f74708d`
- GitHub signature status: verified
- Mutable `v0` tag: not created

## npm

- Package: `mergewarden@0.4.0`
- Tarball files: 5
- Unpacked size: 1.0 MB
- SHA-1: `1be2f4fde16159c7e818593b13d3d5b68b6f931e`
- Integrity: `sha512-KLUaTx590lCK7Kes5i5hF3lP0rSgUwcXddgdN792mHJVv7H7yvxlxQt6PuB9vRHHgK5vAibmy/zCsi4QerD14Q==`
- Published with `--provenance --access public` from the approval-gated
  `publish-npm.yml` run on the signed tag
- First publish used a temporary, expiring granular token wired only into the
  `npm-release` environment; the temporary workflow wiring branch and the
  `NPM_TOKEN` secret were deleted immediately after the publish

## Runtime proof

- Cold `npx --yes mergewarden@0.4.0 --version`: 1.4 seconds, output `0.4.0`
- Public composite scan decision: `warn`
- Public composite scan status: `needs-review`
- Public composite scan findings: 9 error, 2 warning, 1 info

## Public Action proof

- Composite PR: https://github.com/sjh9714/agent-gate-install-smoke-20260617/pull/17
- Action run: https://github.com/sjh9714/agent-gate-install-smoke-20260617/actions/runs/29817195616
- Action ref: full release commit SHA
- Checkout: not used
- Base-branch policy: `mergewarden.yml` (v1 schema) loaded from the base commit
- Findings: contract scope escapes, agent-control-plane drift, workflow- and
  job-scope permission escalation, `id-token` escalation, unpinned action,
  and missing test evidence

The report PNG and the CLI GIF in `docs/assets/` are rendered from real,
timestamped executions of the published npm package against composite PR #17;
they contain no simulated CLI output.

## Pending follow-ups

- Configure the npm Trusted Publisher for `mergewarden`
  (`sjh9714/mergewarden`, `publish-npm.yml`, `npm-release`) and revoke the
  temporary first-publish token.
- Refresh the GitHub Marketplace listing to the MergeWarden name and v0.4.0.
