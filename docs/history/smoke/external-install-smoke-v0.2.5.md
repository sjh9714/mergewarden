# External Install Smoke: v0.2.5

This document records an external first-run install smoke for Agent Gate
`v0.2.5`.

## Target

- Sandbox repository: https://github.com/sjh9714/agent-gate-install-smoke-20260617
- Smoke pull request: https://github.com/sjh9714/agent-gate-install-smoke-20260617/pull/11
- Workflow run: https://github.com/sjh9714/agent-gate-install-smoke-20260617/actions/runs/28232902050
- Action ref: `sjh9714/Agent-Gate@v0.2.5`
- Action commit: `7a9584960ba57e4fe7387bb4afb1edffad5cb2a3`

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
- Existing sandbox pull requests #1 through #10 were not modified.

## README First-Run Path Verification

- The smoke workflow used the same Action shape as the README observe-mode
  template.
- The Action loaded from `sjh9714/Agent-Gate@v0.2.5`.
- The workflow did not include `actions/checkout`.
- The base branch did not contain `agent-gate.yml`.
- Agent Gate emitted the expected missing-config warning and used the built-in
  default policy.

## Result

- Check conclusion: success
- Pull request state after smoke: open and unmerged
- Final decision: `warn`
- Risk score: `8 / 100`

## Package Lifecycle Script Drift Verification

- The smoke PR added a `preinstall` script in `package.json`.
- The compact log included:
  `- warn agf_2ac4687b2f8f712a dependency/lifecycle-script-added package.json`
- The log included:
  - `Agent Gate: NEEDS HUMAN DECISION`
  - `Decision: warn`
  - `Risk score: 8 / 100`
  - `Why: preinstall script added in package.json.`
  - `Path: package.json`
  - `Policy status: warning today; eligible to become a merge gate after tuning.`

## Zero-Config Verification

- The log showed the expected warning:
  `Agent Gate could not load agent-gate.yml from the base branch; using built-in default policy.`
- The run confirmed the built-in default policy path for a missing default
  `agent-gate.yml`.

## Maintenance Note

The run also showed GitHub's REST Contents API deprecation warning while reading
changed file content. The warning did not block the smoke and remains future
maintenance context.
