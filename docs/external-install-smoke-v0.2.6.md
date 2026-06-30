# External Install Smoke: v0.2.6

This document records an external workflow permission context smoke for Agent
Gate `v0.2.6`.

## Target

- Sandbox repository: https://github.com/sjh9714/agent-gate-install-smoke-20260617
- Smoke pull request: https://github.com/sjh9714/agent-gate-install-smoke-20260617/pull/14
- Workflow run: https://github.com/sjh9714/agent-gate-install-smoke-20260617/actions/runs/28440045859
- Action ref: `sjh9714/Agent-Gate@v0.2.6`
- Action commit: `75b52b1b02f33ff53117f459fded7312a4a34bfe`

## Installation Shape

- Repository visibility: public
- Workflow trigger: `pull_request`
- Checkout step: not used
- Observed token permissions:
  - `contents: read`
  - `pull-requests: read`
- Action mode: `warn`
- `fail-on-block`: `false`
- Default base-branch `agent-gate.yml`: absent
- Existing sandbox pull requests #1 through #13 were not modified.

## README First-Run Path Verification

- The Action loaded from `sjh9714/Agent-Gate@v0.2.6`.
- The workflow did not include `actions/checkout`.
- The base branch did not contain `agent-gate.yml`.
- Agent Gate emitted the expected missing-config warning and used the built-in
  default policy.
- Report metadata recorded `configSource: default`.

## Result

- Check conclusion: success
- Pull request state after smoke: open and unmerged
- Final decision: `warn`
- Risk score: `40 / 100`

## Workflow Permission Context Verification

- The smoke PR changed `.github/workflows/demo-release.yml`.
- The workflow-level `permissions.contents` changed from `read` to `write`.
- The `publish` job removed restrictive job-level `permissions.contents: read`,
  exposing the broader workflow-level `contents: write` permission.
- The compact log included:
  - `Agent Gate: NEEDS HUMAN DECISION`
  - `Decision: warn`
  - `Risk score: 40 / 100`
  - `Why: contents permission increased from read to write at workflow scope; this can affect release, tag, and repository content writes. Confirm whether this permission boundary change is expected.`
  - `- error agf_d374fc16f54f99f6 workflow/permission-escalation .github/workflows/demo-release.yml`
  - `- error agf_bff6ec0f720cb045 workflow/permission-escalation .github/workflows/demo-release.yml`

## Evidence Verification

The Markdown and JSON reports included stable evidence for both permission
escalations.

Workflow-scope finding:

- `ruleId: workflow/permission-escalation`
- `evidence.permission: contents`
- `evidence.before: read`
- `evidence.after: write`
- `evidence.permission_scope: workflow`
- `evidence.affected_capability: repository_content_writes`

Job-scope finding:

- `ruleId: workflow/permission-escalation`
- `evidence.permission: contents`
- `evidence.before: read`
- `evidence.after: write`
- `evidence.permission_scope: job`
- `evidence.job: publish`
- `evidence.affected_capability: repository_content_writes`

## Zero-Config Verification

- The log showed the expected warning:
  `Agent Gate could not load agent-gate.yml from the base branch; using built-in default policy.`
- The job summary showed `Policy source: built-in default`.
- The JSON report metadata showed `configSource: default`.

## Notes

- Finding severities remain `error` under the built-in rule, while the Action
  decision is `warn` because first-run rollout uses warn mode.
- The smoke verifies report context only. It does not implement permission
  necessity inference, CODEOWNERS/reviewer evidence, or history replay.
