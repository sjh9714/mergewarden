# Agent Gate v0.3.1 Release Verification

Verified on 2026-07-10 after the unscoped npm name was rejected as too similar
to the existing `agentgate` package.

## Release identity

- Release: https://github.com/sjh9714/Agent-Gate/releases/tag/v0.3.1
- Signed annotated tag object: `5488d3fda61c3a30955e428987ec56ce92212d13`
- Release commit: `5fc4a3a5087620ff23c6cb5b0351c3969339fc01`
- GitHub signature status: verified
- Immutable releases: enabled
- Mutable `v0` tag: not created

## npm

- Package: `@jinhyuk9714/agent-gate@0.3.1`
- Tarball files: 5
- Packed size: 177.3 kB
- Unpacked size: 1.0 MB
- SHA-1: `9beed5b7cb60d36705ecf91561e2fa66a7df5690`
- Integrity: `sha512-Ho5awO/zQuU8gub33U5ykuxtiEYtfi0PhoOUmAhIUzqnIq6vfswytdp3s9HFZAMGmzew3OaUUBoc6iWx/IHJWA==`
- Sigstore transparency log index: `2135466378`
- Trusted Publisher: `sjh9714/Agent-Gate`, `publish-npm.yml`, `npm-release`
- Trusted operation: `npm publish` only
- Traditional package publish tokens: disallowed
- First-publish npm token: revoked
- GitHub `NPM_TOKEN` environment secret: removed

## Runtime proof

- Cold published-package help: 1.70 seconds
- Cold unauthenticated public scan: 5.54 seconds
- Version output: `0.3.1`
- Public scan decision: `warn`
- Public scan status: `needs-review`

## Public Action proof

- Composite PR: https://github.com/sjh9714/agent-gate-install-smoke-20260617/pull/16
- Action run: https://github.com/sjh9714/agent-gate-install-smoke-20260617/actions/runs/29071622785
- Action ref: full release commit SHA
- Checkout: not used
- Findings: contract scope escape, high-risk workflow path,
  agent-control-plane drift, and workflow/job permission escalation

The report PNG is rendered from that run's actual log. The 9.5-second,
1280×720 CLI GIF is rendered from a timestamped 7.97-second execution of the
published npm package; it does not contain simulated CLI output.
