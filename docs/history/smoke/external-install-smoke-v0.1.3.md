# External Install Smoke: v0.1.3

This document records an external install smoke for Agent Gate `v0.1.3`.

## Target

- Sandbox repository: https://github.com/sjh9714/agent-gate-install-smoke-20260617
- Smoke pull request: https://github.com/sjh9714/agent-gate-install-smoke-20260617/pull/1
- Workflow run: https://github.com/sjh9714/agent-gate-install-smoke-20260617/actions/runs/27637102634
- Action ref: `sjh9714/Agent-Gate@v0.1.3`

## Installation Shape

- Repository visibility: public
- Workflow trigger: `pull_request`
- Checkout step: not used
- Observed token permissions:
  - `contents: read`
  - `pull-requests: read`
- Action mode: `warn`
- `fail-on-block`: `false`

## Result

- Check conclusion: success
- Final decision: `warn`
- Risk score: `89 / 100`
- Pull request state after smoke: open and unmerged

The GitHub run summary showed:

- `Agent Gate: NEEDS HUMAN DECISION`
- `Decision: warn`
- `Why`
- `Recommended Next Step`
- `Policy Status`

## Findings Observed

- `contract/out-of-scope`
- `risk/high-risk-path`
- `workflow/permission-escalation`
- `workflow/dangerous-pattern`

The smoke PR intentionally changed `.github/workflows/release.yml` outside the PR
contract scope, added `permissions: contents: write`, used `pull_request_target`
with PR-head checkout, and referenced `secrets.*`.

## Friction Observed

- GitHub runner warned that Node.js 20 Actions are deprecated.
- The Markdown report was visible in the GitHub run summary UI, but not exposed
  through `gh run --log` or Check Run API output.

## Follow-Up Candidates

- Prepare a Node 24 Action runtime migration.
- Consider logging a compact plain-text Agent Gate summary for `gh run --log`
  and API-based debugging.
