# Agent Gate: NEEDS REVIEW

Decision: warn
Status: needs-review

## Why

.github/workflows/container-ci.yml introduces or expands a dangerous GitHub Actions workflow pattern.

Path: .github/workflows/container-ci.yml

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
- Warnings: 2
- Info: 0
- Waived: 0
- Policy digest: cc6c56e3a2e8978b144eb861453bf1a29c765a01fc6f8004c5f62e648d74a6bb

## Detailed Findings

### WARN workflow/dangerous-pattern

.github/workflows/container-ci.yml introduces or expands a dangerous GitHub Actions workflow pattern.

Finding ID: agf_3404ba8a7a6efe4e
Disposition: active

Path: .github/workflows/container-ci.yml

Evidence Snapshot:

- ruleId: workflow/dangerous-pattern
- severity: warn
- path: .github/workflows/container-ci.yml
- evidence.changed_file: .github/workflows/container-ci.yml
- evidence.job: test
- evidence.pattern: unpinned container
- evidence.service: database
- evidence.uses: postgres:17

Evidence:

- changed_file: .github/workflows/container-ci.yml
- pattern: unpinned container
- uses: postgres:17
- job: test
- service: database

Remediation:

- Remove the dangerous workflow pattern or reduce its privileges before merging.

### WARN workflow/dangerous-pattern

.github/workflows/container-ci.yml introduces or expands a dangerous GitHub Actions workflow pattern.

Finding ID: agf_39c8d602d1c6f725
Disposition: active

Path: .github/workflows/container-ci.yml

Evidence Snapshot:

- ruleId: workflow/dangerous-pattern
- severity: warn
- path: .github/workflows/container-ci.yml
- evidence.changed_file: .github/workflows/container-ci.yml
- evidence.job: test
- evidence.pattern: unpinned container
- evidence.uses: node:22

Evidence:

- changed_file: .github/workflows/container-ci.yml
- pattern: unpinned container
- uses: node:22
- job: test

Remediation:

- Remove the dangerous workflow pattern or reduce its privileges before merging.
