# Evidence Model

Agent Gate treats deterministic findings as merge evidence, not as claims of
perfect correctness.

The goal is that a maintainer can inspect a report, understand why a finding
fired, and later re-derive the same finding from recorded inputs. This matters
before any warning is promoted into a blocking gate.

## Finding IDs

Each public finding includes a stable `findingId` such as
`agf_0123456789abcdef`.

The ID is derived from stable finding evidence:

- `ruleId`
- `severity`
- optional `path`
- optional `line`
- normalized evidence label/value pairs

The ID intentionally does not include timestamps, report ordering, risk score,
version, title, message, remediation text, tags, confidence, or commit SHAs.
Those fields may help humans understand a report, but they should not make an
otherwise identical finding look like a different finding.

`findingId` is an audit reference. It does not prove that the finding is
semantically correct.

## Evidence Snapshots

Each public finding also includes an `evidenceSnapshot`.

The snapshot is the canonical input used to derive the finding ID:

```json
{
  "ruleId": "workflow/permission-escalation",
  "severity": "error",
  "path": ".github/workflows/release.yml",
  "evidence": [
    { "label": "after", "value": "write" },
    { "label": "before", "value": "read" },
    { "label": "changed_file", "value": ".github/workflows/release.yml" },
    { "label": "permission", "value": "contents" }
  ]
}
```

The snapshot intentionally excludes mutable display fields such as title,
message, remediation, tags, confidence, risk score, report order, version,
timestamps, and commit SHAs. Those fields can change how a report reads, but
they should not change the stable evidence reference for the same finding.

Use `findingId` as the short audit handle. Use `evidenceSnapshot` as the
re-derivation material. See `docs/evidence-snapshot-example.md` for a compact
report example.

## Re-Derivable Findings

A finding should only become a blocking gate if a third party can re-derive it
from recorded evidence.

For v0.2 planning, a promotable finding should be:

- deterministic
- explainable
- versioned
- re-derivable from recorded evidence
- tunable per repository
- low-noise after warn-mode observation

## Warn Mode

`mode: warn` is not only a gentle default. It is the measurement phase for a
repository's signal precision.

Use warn mode to learn which findings are actionable in the target repository
before promoting them to blocking gates.

## Test Evidence Limits

Matching test-file evidence is change evidence, not semantic correctness proof.

If an agent changes both source code and tests, Agent Gate can show that a risky
change came with matching test-file changes. It cannot prove that the tests are
meaningful, sufficient, or semantically correct.

## Agent Control-Plane Drift

Agent control-plane findings are boundary-change evidence.

When `AGENTS.md`, `.mcp.json`, or similar files change, Agent Gate should not
claim that the new instructions or tool configuration are semantically unsafe.
It should surface that a file capable of changing future agent behavior changed
and needs human review.

## Incomplete Analysis

Agent Gate should be honest about unavailable evidence.

If configured workflow content cannot be read, the analyzer surfaces
`analysis/content-unavailable` instead of silently skipping the affected
workflow analysis.

## Maintainer Overrides

Maintainer override events are future evidence-model work.

An override should not be easier to mutate than the finding it bypassed. A
future override event should reference the finding ID, the evidence snapshot,
the actor, the time, and an optional reason in a durable enough record for a
maintainer or third party to re-check later.

PR comments may be useful mirrors for humans, but mutable comments should not
be the only audit record for a blocking finding and its bypass.

## Planned Rule Families

CODEOWNERS/reviewer evidence, dependency additions, and lockfile drift remain
planned v0.2.x work. They should build on this evidence model instead of
bypassing it.
