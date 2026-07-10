### ERROR analysis/content-unavailable

Unable to read head content for .github/workflows/policy.yml; workflow analysis may be incomplete.

Finding ID: agf_2dd09020942be9c4
Disposition: active

Path: .github/workflows/policy.yml

Evidence Snapshot:

- ruleId: analysis/content-unavailable
- severity: error
- path: .github/workflows/policy.yml
- evidence.changed_file: .github/workflows/policy.yml
- evidence.content_ref: head
- evidence.file_status: modified

Evidence:

- changed_file: .github/workflows/policy.yml
- content_ref: head
- file_status: modified

Remediation:

- Review this workflow change manually or rerun once content is available.
