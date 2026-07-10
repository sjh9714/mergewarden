### ERROR workflow/permission-escalation

contents permission increased from read to write at workflow scope; this can affect release, tag, and repository content writes. Confirm whether this permission boundary change is expected.

Finding ID: agf_37256cec984fbbe3
Disposition: active

Path: .github/workflows/policy.yml

Evidence Snapshot:

- ruleId: workflow/permission-escalation
- severity: error
- path: .github/workflows/policy.yml
- evidence.affected_capability: repository_content_writes
- evidence.after: write
- evidence.before: read
- evidence.changed_file: .github/workflows/policy.yml
- evidence.permission: contents
- evidence.permission_scope: workflow

Evidence:

- changed_file: .github/workflows/policy.yml
- permission: contents
- before: read
- after: write
- permission_scope: workflow
- affected_capability: repository_content_writes

Remediation:

- Review the workflow permission boundary before merging.
- Scope the permission to the smallest workflow or job that needs it.
- Record reviewer approval or repo policy justification before promoting this finding to block.
