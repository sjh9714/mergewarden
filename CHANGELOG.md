# Changelog

All notable changes to MergeWarden (formerly Agent Gate) will be documented in
this file.

This project follows the spirit of
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Unreleased

### Changed

- Rename the project from Agent Gate to MergeWarden. The GitHub repository is
  now `sjh9714/mergewarden`, the npm package is the unscoped `mergewarden`, and
  the executable is `mergewarden`. Old repository URLs redirect; the npm scoped
  package `@jinhyuk9714/agent-gate` remains at v0.3.1 and is deprecated.
- Rename the base-branch policy file from `agent-gate.yml` to `mergewarden.yml`
  and the PR body contract marker from `agent-gate-contract` to
  `mergewarden-contract`. This is a clean break with no compatibility alias;
  see the [v0.4.0 migration guide](docs/migration-v0.4.0.md).
- Rename default report outputs to `mergewarden-report.json` and
  `mergewarden-report.md`, and environment/constant prefixes from `AGENT_GATE`
  to `MERGEWARDEN`. Finding IDs keep the `agf_` prefix so existing waivers
  remain valid.
- Entries below this point predate the rename and intentionally keep the
  original Agent Gate names.

## v0.3.1 - 2026-07-10

### Changed

- Publish the public CLI as `@jinhyuk9714/agent-gate` while preserving the
  `agent-gate` executable name.
- Update `npx`, packaging smoke, CI, and release documentation for the scoped
  package after npm rejected the unscoped name as too similar to `agentgate`.
- Keep the signed `v0.3.0` tag immutable and use a new patch release for the
  source, tarball, and provenance identity change.

## v0.3.0 - 2026-07-10

### Added

- Add public API-only PR scanning through `npx @jinhyuk9714/agent-gate scan`.
- Add a shared private GitHub collection package for the Action and CLI.
- Add file-list completeness, bounded content retrieval, retry, and rate-limit
  evidence that fails closed when analysis cannot complete.
- Add per-check GitHub Actions policy, exact expiring waivers, report
  reproducibility metadata, and narrow agentic workflow injection detection.
- Add public CLI packaging smoke tests, documentation navigation, community
  support files, and an approval-gated npm provenance workflow.

### Changed

- Make workflow dangerous-pattern findings differential against the base
  workflow instead of re-reporting unchanged conditions.
- Sanitize and bound all human report surfaces and distinguish observed,
  needs-review, blocked, and incomplete states.
- Remove severity from finding-ID fingerprints so policy tuning does not change
  the evidence identity.
- Hide the uncalibrated risk score from primary reports while retaining the
  deprecated v0.x API and Action output.
- Reposition Agent Gate as a checkout-free change-control layer for AI PRs and
  reorganize historical release documents under `docs/history/`.

### Removed

- Reject the no-op PR contract `required_evidence` field. Use deterministic
  `high_risk_paths.require_tests` policy instead.

### Security

- Never present a partial GitHub file list or unavailable required content as a
  successful analysis.
- Load policy only from the exact base SHA and preserve structured GitHub API
  errors instead of treating all failures as missing files.
- Require exact GitHub Actions bot ownership before updating a marked PR
  comment.

### Compatibility

- Existing GitHub Actions config remains accepted unless mixed with the new
  `checks` map.
- Finding IDs change once in v0.3.0 because severity is no longer part of the
  fingerprint.
- `riskScore` and `risk-score` remain deprecated through v0.x and are planned
  for removal in v1.

## v0.2.6 - 2026-06-30

### Added

- Add first-report onboarding guidance and Windows install instructions.
- Add live first-run demo PR references for README conversion.
- Add live workflow permission escalation demo evidence.
- Add opt-in PR comment demo evidence.
- Add manual copy-paste install guidance with strict pinning notes.

### Changed

- Add workflow permission escalation scope and affected-capability context to finding
  evidence and reports.
- Sharpen README top copy around checkout-free deterministic evidence.
- Reorder README onboarding around first-run install and default-policy report
  interpretation.
- Document v0.2.5 first-run smoke evidence and simplify README package
  lifecycle wording.
- Promote workflow permission escalation as the primary README proof example.

### Compatibility

- `workflow/permission-escalation` keeps the same `ruleId`, but finding IDs may
  change because v0.2.6 records richer stable evidence for permission scope and
  affected capability.

## v0.2.5 - 2026-06-26

### Added

- Add a tag-pinned observe-mode workflow template for faster first installs.
- Add package lifecycle script drift triage guidance.

## v0.2.4 - 2026-06-26

### Changed

- Add warning-mode package lifecycle script drift findings for added or changed
  `preinstall`, `install`, `postinstall`, and `prepare` scripts.

## v0.2.3 - 2026-06-26

### Changed

- Allow first-run installs without `agent-gate.yml` by falling back to the
  built-in default policy when the base-branch config is missing.
- Record default-policy fallback in report metadata as `configSource: default`.

## v0.2.2 - 2026-06-24

### Security

- Patch the transitive `undici` runtime dependency used by the committed Action
  bundle to resolve Dependabot alerts.

### Changed

- Align package versions and Agent Gate report metadata to `0.2.2`.

## v0.2.1 - 2026-06-21

### Changed

- Add evidence snapshots to findings so reports carry the stable material used
  to re-derive finding IDs.

## v0.2.0 - 2026-06-18

### Changed

- Add a version consistency test for package versions and Agent Gate version
  constants.
- Add stable finding IDs to JSON, Markdown, and compact plain-text reports as
  the foundation for v0.2 evidence-model work.
- Document the evidence model for re-derivable findings, warn-mode signal
  measurement, test-evidence limits, agent-control-plane drift boundaries, and
  future override audit concerns.

## v0.1.6 - 2026-06-17

### Changed

- Reject planned-but-unimplemented config and contract fields instead of
  accepting them as no-op settings.
- Report metadata now uses the current Agent Gate version instead of `0.0.0`.
- Surface unavailable GitHub Actions workflow content as an
  `analysis/content-unavailable` finding instead of silently skipping the
  affected workflow analysis.

## v0.1.5 - 2026-06-17

### Changed

- Add a compact plain-text Action log summary so Agent Gate decisions are
  visible in `gh run --log`.
- Runtime rule behavior and JSON decisions are unchanged.

## v0.1.4 - 2026-06-17

### Changed

- Migrate the GitHub Action runtime metadata and committed Action bundle build
  target to Node 24 to address the previous runtime deprecation warning.
- Runtime rule behavior is unchanged.

## v0.1.3 - 2026-06-16

### Security

- Pin the Action build toolchain to `esbuild@0.28.1` to address Dependabot
  security alerts in development dependencies.

## v0.1.2 - 2026-06-14

### Changed

- Markdown reports now lead with human-facing labels: `PASSED`,
  `NEEDS HUMAN DECISION`, and `BLOCKED`.
- Markdown reports now show `Why`, `Recommended Next Step`, and
  `Policy Status` before detailed findings.
- Finding-derived Markdown values are normalized and truncated for safer job
  summaries and PR comments.
- JSON decisions remain unchanged as `pass`, `warn`, and `block`.
- Runtime rule behavior is unchanged.

## v0.1.1 - 2026-06-14

### Changed

- Rename the Action metadata display name to `Agent Gate for AI PRs` for
  GitHub Marketplace uniqueness.
- Publish the GitHub Marketplace listing for the Action.

## v0.1.0 - 2026-06-14

### Added

- Deterministic core analyzer for AI-generated pull requests.
- `agent-gate.yml` config parsing.
- PR body contract parsing.
- Contract scope rules.
- High-risk path detection.
- Agent control-plane drift detection.
- Missing test evidence detection.
- GitHub Actions workflow permission escalation detection.
- Dangerous workflow pattern detection.
- CLI replay command for deterministic fixture analysis.
- Unsafe PR zoo replay fixtures.
- API-only GitHub Action wrapper.
- Root `action.yml` for `uses: sjh9714/Agent-Gate@<ref>`.
- PR report comment upsert.
- Self-dogfooding Agent Gate workflow.
- Repository CI workflow.

### Security

- The Action loads policy from the PR base branch.
- The Action does not checkout PR code.
- Runtime analysis does not call LLMs.
- Runtime analysis does not execute repository scripts.
- PR report comment API failures are non-fatal warnings.

### Known Limitations

- Comment upsert requires `issues: write` and may not work on fork PRs with
  read-only tokens.
- CODEOWNERS and reviewer evidence are not implemented yet.
- Package and dependency drift rules are not implemented yet.
- GitHub Actions job-level permission escalation comparison is limited.
- Test evidence checks only detect matching test file changes; they do not prove
  semantic coverage.
