# Agent Gate v0.3.0 Release Notes

Agent Gate v0.3.0 turns the project into a practical change-control layer for
AI-generated pull requests.

## Highlights

- Public `npx agent-gate scan owner/repo#123` workflow.
- Shared API-only GitHub collection for the Action and CLI.
- Fail-closed file-list and content completeness checks.
- Safer, bounded reports with honest observe/incomplete statuses.
- Differential GitHub Actions findings and per-check severity.
- Full-SHA action/reusable-workflow pinning and digest-pinned containers.
- Exact, expiring waivers stored only in trusted base policy.
- Narrow agentic workflow injection detection for registered agent Actions.
- Reproducibility metadata: policy digest, SHAs, version, and file counts.

## Compatibility

- `required_evidence` is rejected because it was previously a no-op.
- Finding IDs change because severity is removed from their fingerprint.
- Legacy GitHub Actions config works unless mixed with the new `checks` map.
- `risk-score` remains deprecated through v0.x and is planned for v1 removal.

## Security Boundary

The Action remains checkout-free, API-only, base-policy-controlled, and free of
runtime LLM calls. v0.3 does not claim complete workflow taint analysis or
semantic correctness.

See [migration guidance](migration-v0.3.0.md) and the reusable
[release checklist](release-checklist.md).
