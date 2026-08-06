# Migrating to v0.3.0

## Finding IDs Change Once

Finding IDs no longer include severity. This keeps an exact waiver stable when
a maintainer tunes a check from warning to error. Existing v0.2 IDs must be
re-recorded from a v0.3 report.

## Remove `required_evidence`

PR contract `required_evidence` was accepted but never enforced. v0.3 rejects
it rather than implying protection. Use `high_risk_paths.require_tests` for
deterministic matching-test evidence.

## Prefer Per-Check Workflow Policy

Legacy workflow fields still work by themselves. To migrate, replace them with
`github_actions.checks`. Do not mix legacy and new fields in one config.

## Report Status

Observe-mode findings now render `OBSERVED FINDINGS`, not `PASSED`. Incomplete
analysis always fails, regardless of `fail-on-block`.

## Risk Score

`riskScore` and the Action `risk-score` output remain compatibility aliases,
but they are hidden from primary reports and scheduled for removal in v1. Use
`status`, `analysis-complete`, and explicit counts.

## CLI

The `agent-gate` npm package adds public PR scanning. Replay remains supported.
`--help` now exits successfully; usage and API failures exit 2.
