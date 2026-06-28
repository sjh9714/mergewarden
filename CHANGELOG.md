# Changelog

All notable changes to Agent Gate will be documented in this file.

This project follows the spirit of
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Agent Gate is
pre-release, so APIs and rule names may change between versions.

## Unreleased

### Added

- Add first-report onboarding guidance and Windows install instructions.
- Add live first-run demo PR references for README conversion.

### Changed

- Sharpen README top copy around checkout-free deterministic evidence.
- Reorder README onboarding around first-run install and default-policy report
  interpretation.
- Document v0.2.5 first-run smoke evidence and simplify README package
  lifecycle wording.

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
