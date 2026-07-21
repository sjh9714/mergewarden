# Evidence Snapshot Example

This is the kind of report proof MergeWarden is aiming for: a human-first
decision, a stable finding ID, and enough recorded evidence to understand why
the finding fired.

```text
MergeWarden: NEEDS REVIEW
Decision: warn
Why: contents permission increased from read to write.
Path: .github/workflows/release.yml
Recommended next step: Review the workflow change before merging.
Policy status: warning today; eligible to become a merge gate after tuning.
Findings:
- error agf_... workflow/permission-escalation .github/workflows/release.yml
```

The JSON report keeps the same finding tied to a compact evidence snapshot:

```json
{
  "findingId": "agf_...",
  "ruleId": "workflow/permission-escalation",
  "severity": "error",
  "path": ".github/workflows/release.yml",
  "evidenceSnapshot": {
    "ruleId": "workflow/permission-escalation",
    "severity": "error",
    "path": ".github/workflows/release.yml",
    "evidence": [
      { "label": "affected_capability", "value": "repository_content_writes" },
      { "label": "after", "value": "write" },
      { "label": "before", "value": "read" },
      { "label": "changed_file", "value": ".github/workflows/release.yml" },
      { "label": "permission", "value": "contents" },
      { "label": "permission_scope", "value": "workflow" }
    ]
  }
}
```

The finding ID is the short audit handle. The evidence snapshot is the
re-derivation material. Severity is recorded for display but excluded from the
v0.3 fingerprint, so tuning `warn` to `error` preserves the same identity. This
is not a semantic correctness claim; it is a stable record of the deterministic
inputs that caused MergeWarden to surface the finding.
