### WARN workflow/agentic-untrusted-input

.github/workflows/policy.yml passes untrusted GitHub event data into an agent prompt input.

Finding ID: agf_f81fb77029a5e508
Disposition: active

Path: .github/workflows/policy.yml

Evidence Snapshot:

- ruleId: workflow/agentic-untrusted-input
- severity: warn
- path: .github/workflows/policy.yml
- evidence.changed_file: .github/workflows/policy.yml
- evidence.effective_capability: read-only
- evidence.job: review
- evidence.sink_action: openai/codex-action
- evidence.sink_input: prompt
- evidence.source_expression: github.event.pull_request.body

Evidence:

- changed_file: .github/workflows/policy.yml
- source_expression: github.event.pull_request.body
- sink_action: openai/codex-action
- sink_input: prompt
- job: review
- effective_capability: read-only

Remediation:

- Replace the untrusted prompt value with reviewed, fixed instructions or isolate the agent in a read-only workflow.
