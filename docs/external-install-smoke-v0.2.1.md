# External Install Smoke: v0.2.1

This document records an external install smoke for Agent Gate `v0.2.1`.

## Target

- Sandbox repository: https://github.com/sjh9714/agent-gate-install-smoke-20260617
- Smoke pull request: https://github.com/sjh9714/agent-gate-install-smoke-20260617/pull/5
- Workflow run: https://github.com/sjh9714/agent-gate-install-smoke-20260617/actions/runs/27887941126
- Action ref: `sjh9714/Agent-Gate@v0.2.1`

## Installation Shape

- Repository visibility: public
- Workflow trigger: `pull_request`
- Checkout step: not used
- Observed token permissions:
  - `contents: read`
  - `pull-requests: read`
- Action mode: `warn`
- `fail-on-block`: `false`
- Existing sandbox pull requests #1, #2, #3, and #4 were not modified.

## Result

- Check conclusion: success
- Pull request state after smoke: open and unmerged
- GitHub Actions log confirmed `sjh9714/Agent-Gate@v0.2.1` loaded.
- Final decision: `warn`
- Risk score: `49 / 100`
- The smoke added a no-checkout diagnostic step that greps Agent Gate report files written by the Action. It does not checkout PR code or run repository scripts.

## Log Markers Observed

- `Agent Gate: NEEDS HUMAN DECISION`
- `Decision: warn`
- `Risk score: 49 / 100`
- `Why: Agent-generated PRs must include an agent-gate contract.`
- `Recommended next step: Add a PR contract before relying on scope checks.`
- `Policy status: warning today; eligible to become a merge gate after tuning.`
- Compact finding lines included `agf_[0-9a-f]{16}` finding IDs.

## Evidence Snapshot Verification

- `gh run --log` showed compact finding lines such as:
  - `- error agf_be0c2c2a66312aff contract/missing`
  - `- error agf_987ab9ddb8c1b299 risk/high-risk-path .github/workflows/agent-gate.yml`
  - `- warn agf_6016e753491255d7 workflow/dangerous-pattern .github/workflows/agent-gate.yml`
- The Markdown report file included `Finding ID` entries and `Evidence Snapshot` blocks.
- The JSON report file included `findings[].findingId` and `findings[].evidenceSnapshot` values.

## Findings Exercised

- `agent/origin-detected`
- `contract/missing`
- `risk/high-risk-path`
- `workflow/dangerous-pattern`

## Friction Check

- The smoke log did not show a Node.js 20 deprecation warning.
- The smoke log did not show an `actions/checkout` step.
- The smoke log did not show a GitHub REST contents API deprecation warning in this run.

## Follow-Up Candidate

- Next v0.2 evidence-model design candidate: maintainer override events and storage trust boundary.
