### WARN workflow/dangerous-pattern

.github/workflows/policy.yml deletes a GitHub Actions workflow and its policy-enforced automation.

Finding ID: agf_be728b0db598a51c
Disposition: active

Path: .github/workflows/policy.yml

Evidence Snapshot:

- ruleId: workflow/dangerous-pattern
- severity: warn
- path: .github/workflows/policy.yml
- evidence.changed_file: .github/workflows/policy.yml
- evidence.pattern: workflow deleted

Evidence:

- changed_file: .github/workflows/policy.yml
- pattern: workflow deleted

Remediation:

- Remove the dangerous workflow pattern or reduce its privileges before merging.
