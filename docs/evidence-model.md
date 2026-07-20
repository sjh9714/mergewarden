# Evidence Model

MergeWarden findings are deterministic merge evidence, not claims of perfect
correctness. A maintainer should be able to understand why a rule fired and
re-derive the same reference from the recorded material.

## Finding IDs

Each finding has an ID such as `agf_0123456789abcdef`. It is the first 16 hex
characters of a SHA-256 fingerprint over canonical:

- `ruleId`
- optional path and line
- normalized, sorted evidence label/value pairs

Severity is intentionally excluded in v0.3.0 so a finding remains the same when
a maintainer tunes it from warning to error. Timestamps, ordering, score,
version, title, message, remediation, tags, confidence, and commit SHAs are also
excluded.

Finding IDs are audit handles. They do not prove that a rule is semantically
correct.

## Evidence Snapshots

Every finding retains the canonical re-derivation material:

```json
{
  "ruleId": "workflow/permission-escalation",
  "severity": "error",
  "path": ".github/workflows/release.yml",
  "evidence": [
    { "label": "after", "value": "write" },
    { "label": "before", "value": "read" },
    { "label": "permission", "value": "contents" }
  ]
}
```

The snapshot can include display severity even though the ID fingerprint does
not. Dynamic values are normalized and bounded; long values retain a SHA-256
digest so truncation does not collapse distinct evidence.

## Analysis Metadata

A report records:

- exact base and head SHAs
- canonical base-policy SHA-256 digest
- engine version and Action/npm runtime ref
- expected, analyzed, and content-fetched file counts
- whether analysis completed
- total and omitted finding counts

The GitHub pull-request files endpoint is capped at 3,000 files. MergeWarden
compares the authoritative PR count with the collected list. A mismatch is
`ANALYSIS INCOMPLETE`, never a partial pass.

## Status and Decision

`decision` remains `pass`, `warn`, or `block` for v0.x compatibility. `status`
adds the distinction maintainers need:

- `passed`: complete and clear
- `observed`: observe mode found evidence
- `needs-review`: warning decision
- `blocked`: blocking decision
- `incomplete`: required evidence was unavailable

Incomplete analysis uses `decision: block` for compatibility but is an
integrity failure, independent of `fail-on-block`.

## Exact Waivers

An active waiver is stored in trusted base policy and matches one finding ID.
The report retains the finding, reason, and expiry with `disposition: waived`.
Waived findings do not affect active counts or decisions.

At expiry, the original finding becomes active and MergeWarden emits
`policy/waiver-expired`. Analysis-integrity findings cannot be waived.

## Limits of Evidence

- A matching test-file change does not prove semantic coverage.
- Agent-control-plane drift means future agent behavior may change; it does not
  prove malicious intent.
- A PR-body contract is an untrusted declaration, not verified authorship.
- The agentic-workflow rule covers registered prompt inputs and one `env` hop,
  not arbitrary cross-step or shell data flow.
- MergeWarden does not replace human review or a semantic security scanner.
