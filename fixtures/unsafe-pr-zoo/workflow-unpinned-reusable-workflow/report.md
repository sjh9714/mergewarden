# MergeWarden: NEEDS REVIEW

Decision: warn
Status: needs-review

## Why

.github/workflows/reusable-call.yml introduces or expands a dangerous GitHub Actions workflow pattern.

Path: .github/workflows/reusable-call.yml

## Recommended Next Step

Review the workflow change before merging.

## Policy Status

Policy status: warning today; eligible to become a merge gate after tuning.

## Summary

- Agent detected: no
- PR-declared contract present: no
- Policy source: local fixture
- Analysis complete: yes
- Files analyzed: 1 / 1
- Errors: 0
- Warnings: 1
- Info: 0
- Waived: 0
- Policy digest: ab1f32fc3aabd5939a511c852b7cd4ab4a78c83e50dd3732dc4d105cd2d26408

## Detailed Findings

### WARN workflow/dangerous-pattern

.github/workflows/reusable-call.yml introduces or expands a dangerous GitHub Actions workflow pattern.

Finding ID: agf_d11316bb62ec5943
Disposition: active

Path: .github/workflows/reusable-call.yml

Evidence Snapshot:

- ruleId: workflow/dangerous-pattern
- severity: warn
- path: .github/workflows/reusable-call.yml
- evidence.changed_file: .github/workflows/reusable-call.yml
- evidence.job: call
- evidence.pattern: unpinned reusable workflow
- evidence.uses: owner/repository/.github/workflows/reusable.yml@​main

Evidence:

- changed_file: .github/workflows/reusable-call.yml
- pattern: unpinned reusable workflow
- uses: owner/repository/.github/workflows/reusable.yml@​main
- job: call

Remediation:

- Remove the dangerous workflow pattern or reduce its privileges before merging.
