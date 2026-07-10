# External Install Smoke: v0.2.4

This document records an external install smoke for Agent Gate `v0.2.4`.

## Target

- Sandbox repository: https://github.com/sjh9714/agent-gate-install-smoke-20260617
- Smoke pull request: https://github.com/sjh9714/agent-gate-install-smoke-20260617/pull/10
- Workflow run: https://github.com/sjh9714/agent-gate-install-smoke-20260617/actions/runs/28224576459
- Action ref: `sjh9714/Agent-Gate@v0.2.4`

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
- Existing sandbox pull requests #1 through #9 were not modified.

## Result

- Check conclusion: success
- Pull request state after smoke: open and unmerged
- GitHub Actions log confirmed `sjh9714/Agent-Gate@v0.2.4` loaded.
- Final decision: `warn`
- Risk score: `8 / 100`

## Package Lifecycle Script Drift Verification

- The smoke PR added a `preinstall` script to an existing `package.json`.
- The compact log included:
  `- warn agf_2ac4687b2f8f712a dependency/lifecycle-script-added package.json`
- The Markdown report contained:
  - `dependency/lifecycle-script-added`
  - `Finding ID: \`agf\_`
  - `Snapshot:`
- The JSON report contained:
  - `decision: "warn"`
  - `metadata.configSource: "default"`
  - `findings[].ruleId: "dependency/lifecycle-script-added"`
  - `findings[].findingId`
  - `findings[].evidenceSnapshot`
  - `script: "preinstall"` evidence

## Zero-Config Verification

- The log showed the expected warning:
  `Agent Gate could not load agent-gate.yml from the base branch; using built-in default policy.`
- The report verification step parsed `agent-gate-report.json` and checked
  `configSource: default`.

## Log Markers Observed

- `Agent Gate: NEEDS HUMAN DECISION`
- `Decision: warn`
- `Risk score: 8 / 100`
- `Why: preinstall script added in package.json.`
- `Path: package.json`
- `Policy status: warning today; eligible to become a merge gate after tuning.`
- `dependency/lifecycle-script-added`

## Friction Check

- The smoke log did not show an `actions/checkout` step.
- The smoke log did not show a Node.js 20 deprecation warning.
