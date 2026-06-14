# Changelog

All notable changes to Agent Gate will be documented in this file.

This project follows the spirit of
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Agent Gate is
pre-release, so APIs and rule names may change between versions.

## Unreleased

No changes yet.

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
