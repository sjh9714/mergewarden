### WARN workflow/base-invalid

.github/workflows/policy.yml has a valid head workflow, but its base workflow cannot be parsed for differential checks.

Finding ID: agf_1bc0bab7157df6ea
Disposition: active

Path: .github/workflows/policy.yml

Evidence Snapshot:

- ruleId: workflow/base-invalid
- severity: warn
- path: .github/workflows/policy.yml
- evidence.changed_file: .github/workflows/policy.yml
- evidence.parse_error: Flow sequence in block collection must be sufficiently indented and end with a \]

Evidence:

- changed_file: .github/workflows/policy.yml
- parse_error: Flow sequence in block collection must be sufficiently indented and end with a \]

Remediation:

- Review the complete workflow manually before merging.
