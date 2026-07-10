### ERROR analysis/file-list-incomplete

Expected 42 files but collected 41.

Finding ID: agf_392a3cb65e116fc7
Disposition: active

Evidence Snapshot:

- ruleId: analysis/file-list-incomplete
- severity: error
- evidence.collected_files: 41
- evidence.expected_files: 42

Evidence:

- expected_files: 42
- collected_files: 41

Remediation:

- Reduce or split the pull request, then rerun Agent Gate with a complete file list.
